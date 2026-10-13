#!/usr/bin/env python3
"""Patch LLBox workflow for natural conversation — fix robotic order-ID loops."""

import json
from pathlib import Path

TARGET = Path(__file__).parent / "LLBox_Complete_AI_Production.json"

PARSE_VALIDATE = r'''

const prev = $('Build AI System Prompt').item.json;
const allowed = prev.allowedActions;
const allowedActors = ['customer','driver','unknown'];
const allowedTrust = ['L0','L1','L2','L3'];
const text = String(prev.text || '').toLowerCase().trim();
const rawText = String(prev.text || '').trim();
const session = prev.session || {};
const staticData = $getWorkflowStaticData('global');
staticData.sessions = staticData.sessions || {};
staticData.sessionsV3 = staticData.sessionsV3 || {};

function detectLang(t) {
  if (!t) return 'en';
  if (!/[\u0600-\u06FF]/.test(t)) return 'en';
  const urdu = /[\u0679\u0688\u0691\u06BA\u06C1\u06C2\u06D2\u06CC\u06AF\u06A9]/;
  return urdu.test(t) ? 'ur' : 'ar';
}
const lang = detectLang(rawText);

const ORDER_STOP = new Set([
  'RIDER','DRIVER','ORDER','ORDERS','LOCKER','HELLO','HI','HEY','WHATSAPP','DELIVERY','DELIVER',
  'DELIVERING','PACKAGE','PACKAGES','AMAZON','NOON','LOCATION','ADDRESS','CUSTOMER','OTP','CODE',
  'COLLECT','COLLECTING','COLLECTION','PICKUP','PICK','YES','NO','OK','OKAY','THANKS','THANKYOU',
  'AGENT','PLEASE','HELP','DETAILS','REFERENCE','TRACKING','NUMBER','STATUS','WHERE','WHAT',
  'SEND','NEED','WANT','PACKAGE','PARCEL','BOX','LLBOX'
]);

const extractOrder = (value) => {
  const s = String(value || '').trim();
  if (!s) return '';
  const ocrLine = s.match(/order_reference:\s*([A-Z0-9][A-Z0-9_-]{5,})/i);
  if (ocrLine) {
    const ref = ocrLine[1].toUpperCase();
    const compact = ref.replace(/[^A-Z0-9]/g, '');
    if (compact.length >= 8 && /[0-9]/.test(compact)) return ref;
  }
  const labelMatch = s.match(/\border[\s_-]*(?:id|ref(?:erence)?|number|no)[:\s#-]+([A-Z0-9][A-Z0-9_-]{5,})/i);
  if (labelMatch) {
    const fromLabel = labelMatch[1].toUpperCase();
    if (/^\d{6,22}$/.test(fromLabel) || /^X360/i.test(fromLabel) || /^(ORDER|ORD|AMZ|OD|NSAI)/i.test(fromLabel)) {
      return fromLabel;
    }
  }
  const patterns = [
    /X360[-_][A-Z0-9-]{6,}/i,
    /\bOD\d{10,}\b/i,
    /\bNSAI\d+[A-Z0-9_-]*/i,
    /\b(?:ORDER|ORD)[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*/i,
    /\b(?:AMZ|AMZN)[-_]?[A-Z0-9]+(?:[-_][A-Z0-9]+)*/i,
    /\bN\d{8,}\b/i,
    /\b\d{6,22}\b/,
    /\b[A-Z]{2,}\d[-A-Z0-9]{5,}\b/i,
    /\b[A-Z0-9]{3,}[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const ref = m[0].toUpperCase();
    const compact = ref.replace(/[^A-Z0-9]/g, '');
    if (ORDER_STOP.has(compact) || compact.length < 6) continue;
    if (/^ORDERREFERENCE$/i.test(compact) || /^ORDERID$/i.test(compact)) continue;
    if (!/[0-9]/.test(compact) && !/[-_]/.test(ref)) continue;
    if (/^(ORDER|ORD|AMZ|AMZN)[-_][A-Z]+$/.test(ref) && !/[0-9]/.test(ref)) continue;
    if (!/^X360/i.test(ref) && !/[0-9]/.test(compact)) continue;
    return ref;
  }
  return '';
};

const isValidOrderRef = (ref) => {
  if (!ref) return false;
  const u = String(ref).toUpperCase();
  const compact = u.replace(/[^A-Z0-9]/g, '');
  if (ORDER_STOP.has(compact)) return false;
  if (compact.length < 6) return false;
  if (/^(ORDER|ORD|AMZ|AMZN)[-_][A-Z]+$/.test(u) && !/[0-9]/.test(u)) return false;
  if (!/^X360/i.test(u) && !/[0-9]/.test(compact)) return false;
  return true;
};

const mediaBlob = String(prev.imageAnalysis || prev.documentResult || prev.mediaBlob || '');
let ocrExtra = '';
try {
  const n = $('Normalize Media Context').item.json || {};
  ocrExtra = String(n.imageAnalysis || n.documentResult || n.mediaBlob || '');
} catch (e) { ocrExtra = ''; }
const ocrText = mediaBlob || ocrExtra;
const isMediaUpload = ['image','document','audio'].includes(String(prev.inputType || ''));
const hasMediaData = Boolean(ocrText);
const orderFromMedia = extractOrder(ocrText);
const orderFromText = extractOrder(rawText);
const orderFromMsg = orderFromText || orderFromMedia;
// New invoice/photo OR a newly typed order ID must replace the cached session order.
let orderRef = '';
if (isMediaUpload) {
  orderRef = orderFromMedia || orderFromText || '';
} else if (orderFromText) {
  // Rider typed a new tracking/order ID — always switch (multi-drop same box).
  orderRef = orderFromText;
} else {
  orderRef = prev.lastOrderReference || session.orderReference || '';
}
if (!isValidOrderRef(orderRef)) orderRef = '';

// When switching to a different order, wipe prior locker/OTP cache so we do not reuse A for B.
const prevOrder = String(session.orderReference || prev.lastOrderReference || '').toUpperCase();
if (orderRef && prevOrder && orderRef !== prevOrder) {
  try {
    const phoneKey = prev.phone;
    const sSwitch = staticData.sessions[phoneKey] || {};
    const s3Switch = staticData.sessionsV3[phoneKey] || {};
    for (const store of [sSwitch, s3Switch, session]) {
      store.deliverySessionId = '';
      store.boxId = '';
      store.boxCode = '';
      store.address = '';
      store.googleMaps = '';
      store.otp = '';
      store.otpExpiresAt = '';
      store.locationSent = false;
      store.otpSent = false;
      store.orderReference = orderRef;
      store.currentSubState = 'HAS_ORDER_REF';
    }
    if (phoneKey) {
      staticData.sessions[phoneKey] = { ...(staticData.sessions[phoneKey] || {}), ...sSwitch };
      staticData.sessionsV3[phoneKey] = { ...(staticData.sessionsV3[phoneKey] || {}), ...s3Switch };
    }
  } catch (e) {}
}

// --- Intent flags: declare ALL before any use (fixes TDZ / wantsOtp error) ---
const isGreetingOnly = /^(hi+|hello|hey+|salam|assalam|marhaba|good morning|good evening)[.!\s]*$/i.test(rawText);
const startsWithHi = /^(hi+|hello|hey+|salam|assalam|marhaba)\b/i.test(rawText);
const isGreeting = isGreetingOnly;
const isRoleDeliver = /^(deliver|delivery|delivering|rider|driver)\b/i.test(rawText)
  || /\b(i am|i'?m|im|this is)\s+(a\s+)?(delivery agent|driver|rider)\b/i.test(text)
  || /\byour\s+\w+\s+driver\b/i.test(text)
  || /\b(supermall|noon|amazon|jahez|careem)\s+driver\b/i.test(text)
  || /\b(from\s+)?(noon|amazon|jahez).*(deliver|rider|driver)\b/i.test(text)
  || /\b(deliver|rider|driver).*(noon|amazon|jahez)\b/i.test(text)
  || /\bat (your|the) door\b/i.test(text)
  || /\bproceed with (the )?delivery\b/i.test(text)
  || /\bno answer\b.*\b(deliver|order|door)\b/i.test(text)
  || /\b(deliver|order|door)\b.*\bno answer\b/i.test(text);
const isRoleCollect = /^(collect|collecting|collection|customer|custmer|custmor|pickup|pick up)\b/i.test(rawText)
  || /\b(i am|i'?m|im)\s+(the\s+)?(customer|custmer|custmor)\b/i.test(text)
  || /\b(i want (my )?(parcel|package|box)|come (to )?collect|picking up)\b/i.test(text)
  || (/\bcollect\b/i.test(text) && !/\bdeliver\b/i.test(text));
const isNoDelivery = /\bno delivery\b|\bno order\b|\bnothing to deliver\b|\bno package\b/i.test(text);
const isHelpQuestion = /\b(what is|what's|whats|what does|where (can|do|to|should) (i |)(find|get)|where is my|how (do i|to) find|don'?t know|dont know|do not know|i don'?t have|i dont have|no order|not sure|explain|tell me (where|what)|tracking reference|tracking number|order id|order ref|order number|reference number|what.*mean|what you need|what do you need|could you help|how should i|make an order|add (the )?order|new order|put order id)\b/i.test(text)
  || rawText === 'where?' || rawText === 'where';
// "How should I proceed with the delivery?" is an action request, not "what is an order ID?"
const isDeliveryProceedAsk = /\b(proceed with (the )?delivery|at (your|the) door|no answer|how (should|do) i (deliver|drop|proceed))\b/i.test(text);
const isHowToQuestion = /\b(how (to|do i)|want to know how|how does.*work|steps to|process for)\b/i.test(text)
  && /\b(deliver|delivery|collect|pickup|pick up|locker|order id|order)\b/i.test(text)
  && !isDeliveryProceedAsk
  && !orderRef;
const userConfused = (isHelpQuestion || isHowToQuestion) && !orderRef && !isDeliveryProceedAsk;
// Carrier mention for ROLE only — ignore amazon/noon inside order-like tokens (ORDER-AMAZON-123)
const textNoOrder = text.replace(/\b(?:order|ord|x360|amz|amzn)[-_][a-z0-9_-]+/gi, ' ');
const mentionsCarrier = /\bnoon\b|\bamazon\b|\bama[sz]on\b|\bjahez\b|\bdelivery from\b/.test(textNoOrder)
  || (/\b(driver|rider)\b/.test(textNoOrder) && !isRoleCollect);

const wantsOtp = /\botp\b|\bcode\b|\bpin\b|\bopen (the )?locker\b|\baccess code\b/i.test(text);
const wantsLocation = /\b(location|loc|address|map|locker|google ?maps|my location|delivery location|where (is|should i deliver|to deliver)|send (me )?(the )?loc|give (me )?(the )?location)\b/i.test(text)
  || /please.*\blocation\b/i.test(text)
  || /\b(how should i proceed|how (do|to) (i )?proceed|what (should|do) i do|at (your|the) door|no answer|nobody (home|answered)|not answering)\b/i.test(text);

const isBareYes = /^(yes|yeah|yep|y|sure|please|ok|okay|haan|ha|go ahead)$/i.test(rawText.trim());
const awaitingChoice = session.lastPromptType === 'LOCATION_OR_OTP'
  || ['HAS_ORDER_REF','AWAITING_NEED'].includes(String(session.currentSubState || ''));

const wantsLocationFinal = wantsLocation || (isBareYes && awaitingChoice && orderRef && !wantsOtp);
const wantsResolve = Boolean(orderRef && (wantsLocationFinal || wantsOtp));

const HELP_REPLIES = {
  en: {
    findRef: "No problem. Check your SMS, courier app, or the sticker on the parcel — that number is your order ID. Send it here.",
    howDeliver: "Easy: send me the order number from the parcel label. Then I will send the locker location.",
    greeting: "Hi! I am from LLBox. Are you delivering a package, or collecting one?",
    thanks: "You are welcome! Need the locker location or OTP anytime — just ask.",
    roleDriver: "Okay — you are the rider. Send the order number from the label or app, and I will send the locker location.",
    roleCustomer: "Okay — you are collecting. Send the order number, then I can send the locker location or OTP.",
    noDelivery: "No problem. When you have a delivery, just send the order number.",
    clarifyNeed: "I only need the order number from the parcel label or courier app. Then I help with location or OTP."
  },
  ar: {
    findRef: "تمام. رقم التتبع في SMS أو التطبيق أو على ملصق الشحنة. أرسله هنا.",
    howDeliver: "أرسل رقم الطلب من الملصق وسأرسل موقع الصندوق.",
    greeting: "مرحباً! أنا من LLBox. هل أنت سائق توصيل أم تستلم طرداً؟",
    thanks: "العفو! إذا احتجت الموقع أو OTP أخبرني.",
    roleDriver: "حسناً — أنت للتوصيل. أرسل رقم الطلب وسأرسل موقع الصندوق.",
    roleCustomer: "حسناً — أنت للاستلام. أرسل رقم الطلب لأساعدك بالموقع أو OTP.",
    noDelivery: "لا بأس. عندما يكون لديك توصيل أرسل رقم الطلب.",
    clarifyNeed: "أحتاج فقط رقم الطلب من الملصق أو التطبيق."
  },
  ur: {
    findRef: "ٹھیک ہے — SMS، ایپ، یا لیبل پر آرڈر نمبر دیکھیں اور بھیج دیں۔",
    howDeliver: "لیبل سے آرڈر نمبر بھیجیں، میں لاکر لوکیشن بھیج دوں گا۔",
    greeting: "سلام! میں LLBox سے ہوں۔ آپ ڈیلیور کر رہے ہیں یا پیکج لینے آئے ہیں؟",
    thanks: "خوش آمدید! لوکیشن یا OTP چاہیے تو بتائیں۔",
    roleDriver: "سمجھ گیا — آپ رائڈر ہیں۔ لیبل سے آرڈر نمبر بھیجیں، میں لوکیشن دوں گا۔",
    roleCustomer: "سمجھ گیا — آپ پیکج لینے آئے ہیں۔ آرڈر نمبر بھیجیں تاکہ لوکیشن یا OTP دوں۔",
    noDelivery: "کوئی بات نہیں۔ جب ڈیلیوری ہو تو آرڈر نمبر بھیج دیں۔",
    clarifyNeed: "مجھے صرف آرڈر نمبر چاہیے — لیبل یا ایپ سے۔"
  }
};
const L = HELP_REPLIES[lang] || HELP_REPLIES.en;

let out = null;
try {
  out = JSON.parse($json.choices?.[0]?.message?.content || '{}');
} catch (e) { out = null; }

const safeFallback = {
  actor: prev.actorType || 'unknown',
  intent: 'CHAT',
  language: lang,
  trust_level: prev.trustLevel || 'L0',
  requires_verification: false,
  action: 'chat',
  tool_required: false,
  confidence: 0,
  reply: (isGreeting || startsWithHi || rawText.length <= 4) ? L.greeting : L.howDeliver
};

let aiUsed = true;
if (!out || typeof out !== 'object') { out = { ...safeFallback }; aiUsed = false; }
if (!allowed.includes(out.action)) out.action = 'chat';
if (!allowedActors.includes(out.actor)) out.actor = prev.actorType || 'unknown';
if (!allowedTrust.includes(out.trust_level)) out.trust_level = prev.trustLevel || 'L0';
if (typeof out.tool_required !== 'boolean') out.tool_required = false;
if (typeof out.reply !== 'string' || !out.reply.trim()) out.reply = safeFallback.reply;
if (/i'?m here to help with llbox deliveries and lockers/i.test(out.reply)) out.reply = safeFallback.reply;

if (out.order_reference && !isValidOrderRef(out.order_reference)) out.order_reference = '';
// Strip any AI-invented OTP digits from chat replies (OTP must come from LLBox tool only)
if (/\b\d{4,8}\b/.test(out.reply) && /\botp\b|\bcode\b|\bpin\b/i.test(out.reply) && !out.tool_required) {
  out.reply = orderRef
    ? ('Got it — checking ' + orderRef + ' with LLBox for the real OTP now.')
    : L.clarifyNeed;
}

if (/^\s*[\d\-\*•]/m.test(out.reply) || (out.reply.match(/\n/g) || []).length > 1) {
  out.reply = userConfused ? L.findRef : safeFallback.reply;
}

let sessionRole = session.role || '';
let lastPromptType = '';

if (isGreetingOnly && !orderRef && !isRoleDeliver && !isRoleCollect) {
  out.action = 'chat'; out.tool_required = false; out.intent = 'GREETING'; out.reply = L.greeting;
} else if (startsWithHi && isRoleCollect && !orderRef) {
  out.actor = 'customer'; out.action = 'chat'; out.tool_required = false;
  out.intent = 'ROLE_CUSTOMER'; out.reply = L.roleCustomer;
  sessionRole = 'customer';
} else if (startsWithHi && isRoleDeliver && !orderRef) {
  out.actor = 'driver'; out.action = 'chat'; out.tool_required = false;
  out.intent = 'ROLE_DRIVER'; out.reply = L.roleDriver;
  sessionRole = 'rider';
} else if (/^(thanks|thank you|shukriya|jazakallah)\b/i.test(rawText)) {
  out.action = 'chat'; out.tool_required = false; out.intent = 'ACK'; out.reply = L.thanks;
} else if (isNoDelivery) {
  out.action = 'chat'; out.tool_required = false; out.intent = 'NO_DELIVERY'; out.reply = L.noDelivery;
  orderRef = '';
} else if (isRoleDeliver && !orderRef) {
  out.actor = 'driver'; out.action = 'chat'; out.tool_required = false;
  out.intent = 'ROLE_DRIVER'; out.reply = L.roleDriver;
  sessionRole = 'rider';
} else if (isRoleCollect && !orderRef) {
  out.actor = 'customer'; out.action = 'chat'; out.tool_required = false;
  out.intent = 'ROLE_CUSTOMER'; out.reply = L.roleCustomer;
  sessionRole = 'customer';
} else if (isRoleCollect && orderRef && !wantsResolve) {
  out.actor = 'customer'; out.action = 'chat'; out.tool_required = false;
  out.intent = 'HAS_ORDER_ASK';
  out.reply = 'Got it — collecting for ' + orderRef + '. Reply "location" or "OTP".';
  sessionRole = 'customer';
  lastPromptType = 'LOCATION_OR_OTP';
} else if (userConfused && !orderRef) {
  out.action = 'chat'; out.tool_required = false;
  out.intent = isHowToQuestion ? 'HOW_TO_HELP' : 'HELP_FIND_REFERENCE';
  out.reply = (/\bwhat (you|do you) need\b/i.test(text) || /\bcould you help me understand\b/i.test(text))
    ? L.clarifyNeed
    : (isHowToQuestion ? L.howDeliver : L.findRef);
} else if ((isRoleDeliver || mentionsCarrier) && !orderRef && !userConfused) {
  out.actor = 'driver'; out.action = 'chat'; out.tool_required = false;
  out.intent = 'DRIVER_NEED_ORDER_REF'; out.reply = L.roleDriver;
  sessionRole = 'rider';
} else if (orderRef && wantsResolve) {
  const actorIsCustomer = out.actor === 'customer' || sessionRole === 'customer' || isRoleCollect;
  out.actor = actorIsCustomer ? 'customer' : (sessionRole === 'rider' || isRoleDeliver ? 'driver' : out.actor);
  if (out.actor === 'unknown') out.actor = actorIsCustomer ? 'customer' : 'driver';
  const otpOnly = wantsOtp && !wantsLocationFinal;
  out.action = otpOnly && actorIsCustomer ? 'request_collection_otp' : 'resolve_delivery_access';
  out.tool_required = true;
  out.intent = 'RESOLVE_DELIVERY';
  out.responseMode = otpOnly ? 'otp' : (wantsOtp ? 'location_and_otp' : 'location');
  out.reply = otpOnly
    ? ('Checking ' + orderRef + ' with LLBox for your OTP…')
    : ('Got it — fetching locker details for ' + orderRef + '…');
} else if (orderRef && (sessionRole === 'rider' || isRoleDeliver) && !wantsResolve) {
  out.actor = 'driver';
  out.action = 'resolve_delivery_access';
  out.tool_required = true;
  out.intent = 'RESOLVE_DELIVERY';
  out.responseMode = 'location';
  out.reply = 'Got order ' + orderRef + ' — fetching the locker location now…';
} else if (orderRef && !wantsResolve) {
  out.action = 'chat'; out.tool_required = false; out.intent = 'HAS_ORDER_ASK';
  out.reply = 'Got order ' + orderRef + '. Reply "location" or "OTP".';
  lastPromptType = 'LOCATION_OR_OTP';
}

if (['GREETING','HELP_FIND_REFERENCE','HOW_TO_HELP','ACK','CHAT','ROLE_DRIVER','ROLE_CUSTOMER','NO_DELIVERY','HAS_ORDER_ASK','DRIVER_NEED_ORDER_REF'].includes(out.intent)) {
  out.action = 'chat';
  out.tool_required = false;
}

out.trust_level = prev.trustLevel || out.trust_level;
out.order_reference = orderRef || '';

const phone = prev.phone;
const s = staticData.sessions[phone] || session || {};
const s3 = staticData.sessionsV3[phone] || {};
if (sessionRole) { s.role = sessionRole; s3.role = sessionRole; }
s.lastPromptType = lastPromptType || (out.intent === 'HAS_ORDER_ASK' ? 'LOCATION_OR_OTP' : '');
s3.lastPromptType = s.lastPromptType;
if (orderRef) {
  s.orderReference = orderRef;
  s.currentSubState = out.tool_required ? 'RESOLVING' : 'HAS_ORDER_REF';
  s3.orderReference = orderRef;
  s3.currentSubState = s.currentSubState;
} else {
  if (s.orderReference && !isValidOrderRef(s.orderReference)) {
    s.orderReference = '';
    s.currentSubState = sessionRole ? 'NEED_ORDER_REF' : 'START';
  }
  if (s3.orderReference && !isValidOrderRef(s3.orderReference)) {
    s3.orderReference = '';
    s3.currentSubState = sessionRole ? 'NEED_ORDER_REF' : 'START';
  }
}
s.lastActivity = Date.now();
s3.lastActivity = Date.now();
staticData.sessions[phone] = s;
staticData.sessionsV3[phone] = { ...(staticData.sessionsV3[phone] || {}), ...s3 };

return [{ json: {
  ...prev,
  aiDecision: out,
  aiUsed,
  userConfused,
  isHelpQuestion,
  responseMode: out.responseMode || '',
  lastOrderReference: orderRef || '',
  session: {
    ...(session || {}),
    orderReference: orderRef || '',
    role: sessionRole || session.role || '',
    lastPromptType: s.lastPromptType,
    currentSubState: s.currentSubState
  }
} }];
'''
SESSION_EXTRACT_ORDER = r'''
const extractOrder = (value) => {
  const s = String(value || '').trim();
  if (!s) return '';
  const ocrLine = s.match(/order_reference:\s*([A-Z0-9][A-Z0-9_-]{5,})/i);
  if (ocrLine) {
    const ref = ocrLine[1].toUpperCase();
    const compact = ref.replace(/[^A-Z0-9]/g, '');
    if (compact.length >= 8 && /[0-9]/.test(compact)) return ref;
  }
  const labelMatch = s.match(/\border[\s_-]*(?:id|ref(?:erence)?|number|no)[:\s#-]+([A-Z0-9][A-Z0-9_-]{5,})/i);
  if (labelMatch) {
    const fromLabel = labelMatch[1].toUpperCase();
    if (/^\d{6,22}$/.test(fromLabel) || /^X360/i.test(fromLabel) || /^(ORDER|ORD|AMZ|OD|NSAI)/i.test(fromLabel)) {
      return fromLabel;
    }
  }
  const stop = new Set([
    'RIDER','DRIVER','ORDER','ORDERS','LOCKER','HELLO','HI','HEY','WHATSAPP','DELIVERY','DELIVER',
    'DELIVERING','PACKAGE','PACKAGES','AMAZON','NOON','LOCATION','ADDRESS','CUSTOMER','OTP','CODE',
    'COLLECT','COLLECTING','COLLECTION','PICKUP','PICK','YES','NO','OK','OKAY','THANKS','THANKYOU',
    'AGENT','PLEASE','HELP','DETAILS','REFERENCE','TRACKING','NUMBER','STATUS','WHERE','WHAT',
    'SEND','NEED','WANT','PARCEL','BOX','LLBOX'
  ]);
  const patterns = [
    /X360[-_][A-Z0-9-]{6,}/i,
    /\bOD\d{10,}\b/i,
    /\bNSAI\d+[A-Z0-9_-]*/i,
    /\b(?:ORDER|ORD)[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*/i,
    /\b(?:AMZ|AMZN)[-_]?[A-Z0-9]+(?:[-_][A-Z0-9]+)*/i,
    /\bN\d{8,}\b/i,
    /\b\d{6,22}\b/,
    /\b[A-Z]{2,}\d[-A-Z0-9]{5,}\b/i,
    /\b[A-Z0-9]{3,}[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const ref = m[0].toUpperCase();
    if (/^(ORDER|ORD)[-_]?\d{1,5}$/i.test(ref)) continue;
    if (ref.length < 6) continue;
    const compact = ref.replace(/[^A-Z0-9]/g, '');
    if (stop.has(compact)) continue;
    if (/^ORDERREFERENCE$/i.test(compact) || /^ORDERID$/i.test(compact)) continue;
    if (/^(ORDER|ORD|AMZ|AMZN)[-_][A-Z]+$/.test(ref) && !/[0-9]/.test(ref)) continue;
    if (!/[0-9]/.test(compact) && !/[-_]/.test(ref)) continue;
    if (!/^X360/i.test(ref) && !/[0-9]/.test(compact)) continue;
    return ref;
  }
  return '';
};
'''

BUILD_FINAL_REPLY = r'''
const parsed = $('Parse WhatsApp Payload').item.json;
const staticData = $getWorkflowStaticData('global');
staticData.sessionsV3 = staticData.sessionsV3 || {};

const j = { ...parsed, ...$json, phone: parsed.phone, text: parsed.text || $json.text };
const d = j.aiDecision || {};
const session = staticData.sessionsV3[j.phone] || j.session || {};

function extractOrderQuick(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const patterns = [
    /X360[-_][A-Z0-9-]{6,}/i,
    /\bOD\d{10,}\b/i,
    /\bNSAI\d+[A-Z0-9_-]*/i,
    /\b(?:ORDER|ORD)[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*/i,
    /\b(?:AMZ|AMZN)[-_]?[A-Z0-9]+(?:[-_][A-Z0-9]+)*/i,
    /\bN\d{8,}\b/i,
    /\b\d{6,22}\b/,
    /\b[A-Z]{2,}\d[-A-Z0-9]{5,}\b/i,
    /\b[A-Z0-9]{3,}[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const ref = m[0].toUpperCase();
    const compact = ref.replace(/[^A-Z0-9]/g, '');
    if (compact.length < 6 || !/[0-9]/.test(compact)) continue;
    return ref;
  }
  return '';
}

const fromThisMsg = extractOrderQuick(j.text || parsed.text || '');
const orderRefRaw = fromThisMsg || j.lastOrderReference || session.orderReference || d.order_reference || '';
const bogusOrder = /^(DELIVER|DELIVERY|COLLECT|DRIVER|RIDER|CUSTOMER|PACKAGE|LOCATION|HELLO|ORDERAMAZON)$/i.test(String(orderRefRaw).replace(/[^A-Za-z0-9]/g, ''));
let orderRef = orderRefRaw;
if (!orderRefRaw || bogusOrder) orderRef = '';
else if (!/[0-9]/.test(orderRefRaw) && /^(ORDER|ORD|AMZ|AMZN)[-_]/i.test(orderRefRaw)) orderRef = '';
else if (!/[0-9]/.test(orderRefRaw) && !/[-_]/.test(orderRefRaw)) orderRef = '';

let name = String(j.knownName || '').trim();
if (!name || /my name is/i.test(name) || name.length > 40 || /\d{5,}/.test(name)) name = '';
const greet = name ? (name + ', ') : '';

const mode = j.responseMode || d.responseMode || d.intent || '';
let reply = String(j.reply || d.reply || '').trim();
if (/checking (that |your )?order|send(ing)? (the )?(locker )?location|send(ing)? (the )?otp|will send|shortly|one sec/i.test(reply)) {
  reply = '';
}

let notifyCustomerPhone = '';
let notifyCustomerText = '';

const cacheResolve = (data) => {
  data = data || {};
  session.orderReference = orderRef || session.orderReference || '';
  if (data.deliverySessionId) session.deliverySessionId = String(data.deliverySessionId);
  if (data.boxId) session.boxId = data.boxId;
  if (data.boxCode) session.boxCode = data.boxCode;
  if (data.address) session.address = data.address;
  if (data.googleMaps) session.googleMaps = data.googleMaps;
  if (data.otp) session.otp = String(data.otp);
  if (data.otpExpiresAt) session.otpExpiresAt = data.otpExpiresAt;
  if (data.recipientPhone) session.recipientPhone = data.recipientPhone;
  if (data.recipientName) session.recipientName = data.recipientName;
  session.lastActivity = Date.now();
  staticData.sessionsV3[j.phone] = session;
};

if (j.gate && j.gate.allowed === false) {
  const reason = j.gate.denyReason;
  if (reason === 'MISSING_ORDER_REFERENCE') {
    reply = j.reply || d.reply || greet + 'Share the order or tracking number when you have it and I will help right away.';
  } else if (reason === 'OTP_TOO_MANY_ATTEMPTS') {
    reply = session.otp
      ? greet + 'Here is the OTP again: ' + session.otp
      : (j.reply || d.reply || greet + 'Let us pause OTP requests for a moment.');
  } else {
    reply = j.reply || d.reply || greet + 'How can I help with your delivery?';
  }
} else if (j.ticket) {
  const contact = $('Config').item.json.supportPhone;
  reply = greet + 'I have raised this with LLBox support (' + j.ticket.ticket_id + ').' + (contact ? ' You can also call ' + contact + '.' : '');
} else if (j.toolResult && j.toolResult.success === true) {
  const data = j.toolResult.data || j.toolResult;
  const action = (j.gate && j.gate.action) || d.action;
  cacheResolve(data);

  if (action === 'register_delivery') {
    reply = greet + 'Delivery ' + orderRef + ' is registered' + (data.boxCode ? (' for locker ' + data.boxCode) : '') + '.';
  } else if (action === 'get_customer_locker') {
    reply = data.userFound
      ? greet + 'Your locker is ' + (data.locker || data.boxCode || 'assigned') + '.'
      : greet + 'I could not find a locker on this number yet — do you have an order or tracking number?';
  } else {
    const wantOtp = mode === 'otp' || mode === 'REQUEST_OTP' || action === 'request_collection_otp' || /\botp\b|\bcode\b|\bpin\b/i.test(j.text || '');
    const wantLoc = mode === 'location' || mode === 'REQUEST_LOCATION' || /\bloc|address|map|locker|location\b/i.test(j.text || '') || !wantOtp;
    const clearedNote = data.clearedPriorSession
      ? 'Previous locker session cleared — continuing with this order. '
      : '';

    if (wantLoc && !wantOtp) {
      const lines = ['Order: ' + orderRef];
      if (data.boxCode || session.boxCode) lines.push('Locker: ' + (data.boxCode || session.boxCode));
      if (data.address || session.address) lines.push('Address: ' + (data.address || session.address));
      const mapsLoc = data.googleMaps || session.googleMaps || '';
      if (mapsLoc) lines.push('Map: ' + mapsLoc);
      reply = greet + clearedNote + 'Sure — your LLBox is here:\n' + lines.join('\n');
      session.locationSent = true;
      session.currentSubState = 'LOCATION_SENT';
    } else if (wantOtp) {
      // Never invent OTP — only LLBox API / previously cached API OTP
      const otp = data.otp || session.otp;
      if (!otp) {
        reply = greet + 'I reached LLBox for ' + orderRef + ', but no OTP is available yet. Please try again in a moment.';
      } else {
        const lines = ['Order: ' + orderRef, 'OTP: ' + otp];
        if (data.boxCode || session.boxCode) lines.push('Locker: ' + (data.boxCode || session.boxCode));
        if (data.otpExpiresAt || session.otpExpiresAt) lines.push('Expires: ' + (data.otpExpiresAt || session.otpExpiresAt));
        reply = greet + clearedNote + 'Use this OTP to open the locker:\n' + lines.join('\n');
        session.otp = String(otp);
        session.otpSent = true;
        session.currentSubState = 'OTP_SENT';
      }
    } else {
      const lines = ['Order: ' + orderRef];
      if (data.boxCode) lines.push('Locker: ' + data.boxCode);
      if (data.address) lines.push('Address: ' + data.address);
      if (data.googleMaps) lines.push('Map: ' + data.googleMaps);
      reply = greet + clearedNote + 'Here are the details:\n' + lines.join('\n') + '\nTell me if you need the OTP.';
      session.locationSent = true;
    }
    staticData.sessionsV3[j.phone] = session;
  }
} else if (j.toolResult && j.toolResult.success === false) {
  const msg = String(j.toolResult.message || j.toolResult.error || '');
  const detailsMsg = String(
    (j.toolResult.details && (j.toolResult.details.message || j.toolResult.details.reason)) || ''
  );
  const failBlob = msg + ' ' + detailsMsg;
  if (/active delivery session|in_use/i.test(failBlob)) {
    reply = greet + 'That locker still has an open delivery session from a previous order. Send the next order ID again and I will clear it and continue — you can drop multiple orders in the same box one after another.';
    session.orderReference = orderRef || session.orderReference || '';
    session.currentSubState = 'HAS_ORDER_REF';
    staticData.sessionsV3[j.phone] = session;
  } else if ((mode === 'otp' || /\botp\b/i.test(j.text || '')) && session.otp && session.orderReference === orderRef) {
    reply = greet + 'Here is the OTP for ' + orderRef + ': ' + session.otp + (session.boxCode ? (' (locker ' + session.boxCode + ')') : '');
  } else if (/no expected delivery|not found/i.test(failBlob)) {
    reply = greet + 'I could not find that order yet — double-check the full ID on the parcel label and send it again.';
    session.orderReference = '';
    session.currentSubState = session.role ? 'NEED_ORDER_REF' : 'START';
    staticData.sessionsV3[j.phone] = session;
    orderRef = '';
  } else if (session.address || session.googleMaps || session.boxCode) {
    const bits = [];
    if (session.boxCode) bits.push('Locker: ' + session.boxCode);
    if (session.address) bits.push('Address: ' + session.address);
    if (session.googleMaps) bits.push('Map: ' + session.googleMaps);
    reply = greet + 'I could not verify that for ' + (orderRef || 'this order') + '. Here is what I still have:\n' + bits.join('\n');
  } else if (j.reply || d.reply) {
    reply = String(j.reply || d.reply).replace(/^my name is[^,]*,\s*/i, '');
    // Never echo a stale order ID when this message had a different one
    if (fromThisMsg && orderRef && /NSAI|X360|OD\d|ORDER-/i.test(reply) && !reply.includes(orderRef)) {
      reply = greet + 'I could not verify that for ' + orderRef + '. ' + msg.slice(0, 180);
    }
  } else {
    reply = greet + (orderRef
      ? ('I could not verify that for ' + orderRef + '. ' + (msg || 'Please try again, or ask for location/OTP.'))
      : 'Something went wrong on the lookup — try again, or ask me for location or OTP.');
  }
} else if (d.tool_required) {
  reply = j.reply || d.reply || greet + 'Give me a second and try that again.';
} else if (['MEDIA_ORDER_FOUND','MEDIA_NO_ORDER','MEDIA_PROCESS_FAILED'].includes(d.intent)) {
  reply = String(d.reply || j.reply || '').trim();
}

if (!reply || /i am here to help with llbox deliveries and lockers/i.test(reply.toLowerCase())) {
  if (orderRef) {
    reply = greet + 'I have order ' + orderRef + '. Need the locker location or OTP?';
  } else if (j.userConfused || j.isHelpQuestion) {
    reply = d.reply || greet + 'The tracking number is usually in your delivery SMS or on the package label — send it when you have it.';
  } else {
    reply = greet + 'Are you delivering or collecting? If you have an order or tracking number, send it over.';
  }
}

reply = String(reply).replace(/^my name is[^,]*,\s*/i, '').trim();
if (reply.length > 900) reply = reply.slice(0, 897) + '...';

return [{ json: {
  ...j,
  finalReply: reply,
  lastOrderReference: orderRef,
  notifyCustomerPhone,
  notifyCustomerText,
  session
} }];
'''

GATE_DENIED_EXTRA = r'''
// If user asked what/where tracking is, give helpful answer — not another "send order ID"
const helpIntent = j.isHelpQuestion || j.userConfused || ['HELP_FIND_REFERENCE','HOW_TO_HELP'].includes((j.aiDecision || {}).intent);
if (reason === 'MISSING_ORDER_REFERENCE' && helpIntent) {
  const helpMsg = {
    en: `${greet}The order/tracking number is usually in your delivery SMS, courier app, or on the package label. Send it here when you find it.`,
    ar: `${greet}رقم الطلب/التتبع عادةً في SMS أو تطبيق التوصيل أو على ملصق الشحنة. أرسله هنا عندما تجده.`,
    ur: `${greet}آرڈر/ٹریکنگ نمبر عام طور پر SMS، ایپ، یا لیبل پر ہوتا ہے۔ مل جائے تو بھیج دیں۔`,
  };
  const reply = (helpMsg[lang] || helpMsg.en);
  return [{ json: { ...j, reply, needsEscalation: false } }];
}
'''

SYSTEM_PROMPT_ADDITION = r'''
# USER STYLE (CRITICAL)
Users are often non-technical. Keep every reply SHORT (1-2 sentences). Simple words. No essays. No bullet lists.

# TWO FLOWS
RIDER / DRIVER (deliver): ask for order number -> call resolve_delivery_access -> send locker location from LLBox API. OTP only if they ask.
CUSTOMER (collect): ask for order number -> ask location or OTP -> call resolve_delivery_access or request_collection_otp -> reply ONLY with API data.

# MULTI-ORDER SAME BOX
Riders may drop multiple products/orders into the same LLBox one after another.
When they send a NEW order ID, switch to that ID immediately — never keep confirming the previous order.
If the locker still has an open session from the prior order, clear/retry then continue with the new ID.
Do not treat a second order as an error just because the box was used for the first one.

# HELP & CONFUSION
If user asks what order ID / tracking IS, or WHERE to find it, or don't know / don't have it:
- action = "chat", tool_required = false
- Answer: SMS, courier app, or parcel label - send it here
- Do NOT repeat "please send order ID" robotically

# OTP SECURITY (HARD RULE)
- NEVER invent, guess, or generate an OTP / PIN / code yourself
- OTP must come ONLY from LLBox tool result (resolve_delivery_access / request_collection_otp)
- If tool did not return otp, say you could not get it yet - never invent digits
- Never put fake numbers like 1234 or 4589 in replies

# NEVER
- Repeat the same question in a loop
- Call tools for greetings / thanks / "what is tracking number"
- Ask for tracking when user only asked what it means
- Reuse an old order ID after the user typed a different one

'''

def patch_node_code(workflow, node_name, new_code):
    for n in workflow["nodes"]:
        if n["name"] == node_name:
            n["parameters"]["jsCode"] = new_code.strip() + "\n"
            return True
    return False


def patch_system_prompt(workflow):
    for n in workflow["nodes"]:
        if n["name"] != "Build AI System Prompt":
            continue
        code = n["parameters"]["jsCode"]
        multi = (
            "# MULTI-ORDER SAME BOX\n"
            "Riders may drop multiple products/orders into the same LLBox one after another.\n"
            "When they send a NEW order ID, switch to that ID immediately — never keep confirming the previous order.\n"
            "If the locker still has an open session from the prior order, clear/retry then continue with the new ID.\n"
            "Do not treat a second order as an error just because the box was used for the first one.\n\n"
        )
        if "# MULTI-ORDER SAME BOX" not in code:
            if "# TWO FLOWS" in code:
                code = code.replace("# TWO FLOWS", multi + "# TWO FLOWS", 1)
            elif "# USER STYLE (CRITICAL)" in code:
                code = code.replace("# USER STYLE (CRITICAL)", multi + "# USER STYLE (CRITICAL)", 1)
            else:
                code = code.replace("# OUTPUT JSON ONLY", multi + "# OUTPUT JSON ONLY", 1)
            n["parameters"]["jsCode"] = code

        if "OTP SECURITY (HARD RULE)" in code and "# TWO FLOWS" in code:
            return True
        if "# HELP & CONFUSION" in code and "OTP SECURITY (HARD RULE)" not in code:
            import re as _re
            code = _re.sub(r"# HELP & CONFUSION[\s\S]*?(?=\n# |\nOUTPUT|Return ONLY)", "", code, count=1)
            n["parameters"]["jsCode"] = code
        for marker in ("# HARD RULES", "# OUTPUT", "OUTPUT FORMAT", "# OUTPUT FORMAT"):
            if marker in code:
                code = code.replace(marker, SYSTEM_PROMPT_ADDITION.strip() + "\n\n" + marker, 1)
                n["parameters"]["jsCode"] = code
                return True
        # Fallback: append before closing backtick of systemPrompt template
        needle = "Return ONLY a JSON object"
        if needle in code:
            code = code.replace(needle, SYSTEM_PROMPT_ADDITION.strip() + "\n\n" + needle, 1)
            n["parameters"]["jsCode"] = code
            return True
    return False


def patch_gate_denied(workflow):
    for n in workflow["nodes"]:
        if n["name"] != "Build Gate-Denied Reply":
            continue
        code = n["parameters"]["jsCode"]
        if "helpIntent" in code:
            return True
        insert_before = "const pack = MESSAGES[reason]"
        if insert_before not in code:
            return False
        code = code.replace(insert_before, GATE_DENIED_EXTRA.strip() + "\n\n" + insert_before)
        # Also soften default MISSING_ORDER_REFERENCE message
        code = code.replace(
            "Sure — please send the order ID / reference and I'll pull the delivery details for you.",
            "Send me the order/tracking number from your SMS, app, or package label and I'll get the details.",
        )
        n["parameters"]["jsCode"] = code
        return True
    return False


def patch_session_extract(workflow):
    import re
    for n in workflow["nodes"]:
        if n["name"] != "Session Get/Create":
            continue
        code = n["parameters"]["jsCode"]
        # Replace extractOrder function body
        pattern = r"const extractOrder = \(value\) => \{[\s\S]*?\n\};\n"
        if "(?:ORDER|ORD)[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*" in code and "labelMatch" in code and "OD\\d{10,}" in code:
            return True
        new_code, count = re.subn(
            pattern,
            lambda _m: SESSION_EXTRACT_ORDER.strip() + "\n\n",
            code,
            count=1,
        )
        if count != 1:
            return False
        # Also improve role detection for short replies
        if "isRoleDeliver" not in new_code:
            inject = """
const isRoleDeliver = /^(deliver|delivery|delivering)$/i.test(text.trim()) || /\\b(i am|i'?m)\\s+(a\\s+)?(delivery agent|driver|rider)\\b/i.test(lower);
const isRoleCollect = /^(collect|collecting|collection|customer|pickup)$/i.test(text.trim()) || /\\bi am (the )?customer\\b/i.test(lower);
if (isRoleDeliver) session.role = 'rider';
if (isRoleCollect) session.role = 'customer';
if (session.orderReference) {
  const compact = String(session.orderReference).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bogus = new Set(['DELIVER','DELIVERY','COLLECT','DRIVER','RIDER','CUSTOMER','PACKAGE','LOCATION','HELLO']);
  if (bogus.has(compact) || (compact.length >= 4 && !/[0-9]/.test(compact) && !/[-_]/.test(session.orderReference))) {
    session.orderReference = '';
    if (!session.currentSubState || session.currentSubState === 'HAS_ORDER_REF') {
      session.currentSubState = session.role ? 'NEED_ORDER_REF' : 'START';
    }
  }
}
"""
            marker = "session.lastActivity = now;"
            if marker in new_code:
                new_code = new_code.replace(marker, inject + "\n" + marker, 1)
        n["parameters"]["jsCode"] = new_code
        return True
    return False


def patch_greeting(workflow):
    smart = (
        "const text = String($json.text || $json.messageText || '').trim();\n"
        "const lower = text.toLowerCase();\n"
        "function extractOrder(value) {\n"
        "  const s = String(value || '');\n"
        "  const patterns = [\n"
        "    /X360[-_][A-Z0-9-]{6,}/i, /\\bOD\\d{10,}\\b/i, /\\bNSAI\\d+[A-Z0-9_-]*/i,\n"
        "    /\\b(?:ORDER|ORD)[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*/i,\n"
        "    /\\b(?:AMZ|AMZN)[-_]?[A-Z0-9]+(?:[-_][A-Z0-9]+)*/i,\n"
        "    /\\bN\\d{8,}\\b/i, /\\b\\d{6,22}\\b/, /\\b[A-Z]{2,}\\d[-A-Z0-9]{5,}\\b/i,\n"
        "    /\\b[A-Z0-9]{3,}[-_][A-Z0-9]+(?:[-_][A-Z0-9]+)*/i\n"
        "  ];\n"
        "  for (const re of patterns) {\n"
        "    const m = s.match(re);\n"
        "    if (!m) continue;\n"
        "    const ref = m[0].toUpperCase();\n"
        "    const compact = ref.replace(/[^A-Z0-9]/g, '');\n"
        "    if (compact.length >= 6 && /[0-9]/.test(compact)) return ref;\n"
        "  }\n"
        "  return '';\n"
        "}\n"
        "const orderRef = extractOrder(text) || String($json.lastOrderReference || ($json.session && $json.session.orderReference) || '').toUpperCase();\n"
        "const isDriver = /\\b(driver|rider|deliver|delivery|at (your|the) door|supermall)\\b/i.test(lower);\n"
        "let name = ($json.knownName || '').trim();\n"
        "if (!name || /my name is/i.test(name) || name.length > 40 || /\\d{5,}/.test(name)) name = '';\n"
        "const hi = name ? ('Hi ' + name + '! ') : 'Hi! ';\n"
        "let reply = '';\n"
        "let lastIntent = 'GREETING';\n"
        "if (orderRef && isDriver) {\n"
        "  reply = hi + 'Got it — delivering order ' + orderRef + '. Fetching the locker location now…';\n"
        "  lastIntent = 'RESOLVE_DELIVERY';\n"
        "} else if (orderRef) {\n"
        "  reply = hi + 'Got order ' + orderRef + '. Reply \"location\" or \"OTP\".';\n"
        "  lastIntent = 'HAS_ORDER_ASK';\n"
        "} else if (isDriver) {\n"
        "  reply = hi + 'Okay — you are the rider. Send the order number from the label or app, and I will send the locker location.';\n"
        "  lastIntent = 'ROLE_DRIVER';\n"
        "} else {\n"
        "  reply = hi + 'I am from LLBox. Are you delivering a package, or collecting one?';\n"
        "}\n"
        "const session = { ...($json.session || {}) };\n"
        "if (orderRef) { session.orderReference = orderRef; session.currentSubState = 'HAS_ORDER_REF'; if (isDriver) session.role = 'rider'; }\n"
        "else if (isDriver) { session.role = 'rider'; }\n"
        "return [{ json: {\n"
        "  ...$json,\n"
        "  reply,\n"
        "  finalReply: reply,\n"
        "  lastIntent,\n"
        "  lastOrderReference: orderRef || $json.lastOrderReference || '',\n"
        "  session,\n"
        "  aiDecision: {\n"
        "    actor: isDriver ? 'driver' : 'unknown',\n"
        "    intent: lastIntent,\n"
        "    action: (orderRef && isDriver) ? 'resolve_delivery_access' : 'chat',\n"
        "    tool_required: Boolean(orderRef && isDriver),\n"
        "    order_reference: orderRef || '',\n"
        "    responseMode: (orderRef && isDriver) ? 'location' : '',\n"
        "    reply\n"
        "  },\n"
        "  skipPersist: false\n"
        "} }];\n"
    )
    patched = 0
    for n in workflow["nodes"]:
        if n["name"] in ("Build Greeting Reply", "Build Greeting Reply1"):
            n["parameters"]["jsCode"] = smart
            patched += 1
    return patched > 0


def patch_session_first_contact(workflow):
    """Do not short-circuit to dumb greeting when first message already has order/delivery intent."""
    for n in workflow["nodes"]:
        if n["name"] != "Session Get/Create":
            continue
        code = n["parameters"]["jsCode"]
        if "hasDeliverySubstance" in code:
            return True
        old_block = (
            "const shouldGreet = firstEverContact && !session.greeted;\n"
            "if (shouldGreet) session.greeted = true;"
        )
        new_block = (
            "const hasDeliverySubstance = Boolean(foundOrder)\n"
            "  || /\\b(driver|rider|deliver|delivery|collect|otp|location|order|package|parcel|at (your|the) door|proceed)\\b/i.test(text);\n"
            "const shouldGreet = firstEverContact && !session.greeted && !hasDeliverySubstance;\n"
            "if (shouldGreet) session.greeted = true;\n"
            "else if (hasDeliverySubstance) session.greeted = true;"
        )
        if old_block not in code:
            return False
        n["parameters"]["jsCode"] = code.replace(old_block, new_block, 1)
        return True
    return False


def patch_meta_signature(workflow):
    """Verify Meta signatures without reading restricted runtime environment variables."""
    code = r"""const input = $input.first().json || {};

const headers = input.headers || {};
const signatureHeader = String(
  headers['x-hub-signature-256'] ||
  headers['X-Hub-Signature-256'] ||
  ''
).trim();

let config = {};
try {
  config = $('Config').first().json || {};
} catch (_) {
  config = {};
}
const appSecret = String(config.metaAppSecret || input.metaAppSecret || '').trim();

let rawBody = input.rawBody;
if (typeof rawBody !== 'string') rawBody = input.bodyRaw;
if (typeof rawBody !== 'string') rawBody = JSON.stringify(input.body || {});

let signatureValid = false;
let signatureError = '';

if (!appSecret || appSecret === 'PASTE_YOUR_META_APP_SECRET') {
  signatureError = 'META_APP_SECRET_NOT_CONFIGURED';
} else if (!signatureHeader) {
  signatureError = 'MISSING_X_HUB_SIGNATURE_256';
} else if (!/^sha256=[a-f0-9]{64}$/i.test(signatureHeader)) {
  signatureError = 'INVALID_SIGNATURE_FORMAT';
} else {
  try {
    const crypto = require('crypto');
    const received = signatureHeader.slice(7).toLowerCase();
    const expected = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody, 'utf8')
      .digest('hex');
    const a = Buffer.from(received, 'hex');
    const b = Buffer.from(expected, 'hex');
    signatureValid = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!signatureValid) signatureError = 'SIGNATURE_MISMATCH';
  } catch (_) {
    signatureError = 'CRYPTO_VERIFY_FAILED';
  }
}

return [{
  json: {
    ...input,
    signatureValid,
    signatureOk: signatureValid,
    signatureChecked: true,
    signatureError
  }
}];"""
    for n in workflow["nodes"]:
        if n["name"] == "Verify Meta Signature":
            n["parameters"]["jsCode"] = code
            return True
    return False


def main():
    with open(TARGET) as f:
        wf = json.load(f)

    ok = [
        patch_node_code(wf, "Parse & Validate AI Output", PARSE_VALIDATE),
        patch_node_code(wf, "Build Final Reply", BUILD_FINAL_REPLY),
        patch_system_prompt(wf),
        patch_gate_denied(wf),
        patch_greeting(wf),
        patch_session_extract(wf),
        patch_session_first_contact(wf),
        patch_meta_signature(wf),
    ]
    print("Patched:", dict(zip(
        ["Parse", "FinalReply", "SystemPrompt", "GateDenied", "Greeting", "Session", "FirstContact", "MetaSignature"], ok
    )))

    with open(TARGET, "w") as f:
        json.dump(wf, f, indent=2)
    print("Wrote", TARGET)
    print("Written:", TARGET)


if __name__ == "__main__":
    main()
