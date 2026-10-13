/**
 * Inbound WhatsApp text understanding — deterministic, no LLM.
 * Spec: LLBox WhatsApp Chatbot Test Report 2026-09-30 §5.2 (reference extraction),
 * §5.4 (stuck-driver mapping), §5.5 (language policy).
 */

const ARABIC_INDIC = /[\u0660-\u0669]/g;
const PERSIAN_DIGITS = /[\u06F0-\u06F9]/g;
const INVISIBLE_MARKS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u061C]/g;
const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\u20E3]/gu;

const normalizeInbound = (raw = '') =>
  String(raw || '')
    .normalize('NFKC')
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(PERSIAN_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(INVISIBLE_MARKS, '')
    .replace(EMOJI, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();

const refKey = (ref = '') => String(ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

const COMMON_ENGLISH = new Set(
  `a about again also am an and any are at back be big box brother bro but by call can cannot
  code come could customer deliver delivery did do does door down driver find fit for from full
  gate get give has have he hello help her here hi him his how i i'm im in is it its just know
  location map me my need no not now number of ok okay on one open or order outside package parcel
  phone please put reach sir so send she tell thank thanks that the there they this to today too
  try up urgent want was what when where which why will with working yes you your
  coming arriving arrive arrived tomorrow tonight yesterday week next soon later delivered sent
  shipped placed new first second last pls plz confirmed cancel cancelled status same register`
    .split(/\s+/)
    .filter(Boolean)
);

const ARABIZI_TOKENS = new Set(
  `salam salaam assalam assalamu slm wein wain ween fein feen ana enta inta mafi mafee mafeesh
  shukran shokran shukrn yalla habibi habibti akhi akhoy inshallah wallah wallahi marhaba ahlan
  kbeer kbir kabeer msh mish mush yodkhol yadkhol wasalt wsalt wasal tawseel ta3al la2 aiwa aywa
  na3am sho shu eish esh keef kif hon hena hina mawjood mawjoud 3ndi 3andi 7abibi ma3lesh ma3lish
  zain zein tamam khalas shloon shlonak`
    .split(/\s+/)
    .filter(Boolean)
);

const URDU_LETTERS = /[\u0679\u0688\u0691\u06BA\u06D2\u06C1\u06BE\u06CC\u06A9\u06AF]/;
const URDU_WORDS = /(^|\s)(میں|ہوں|ہے|ہیں|کہاں|کیا|نہیں|آرڈر|بھائی|کا|کی|کو)(?=\s|$|[،؟.!])/;

/**
 * Detect the message language.
 * @returns {'en'|'ar'|'mixed'|'arabizi'|'ur'|'hi'|'bn'|'none'}
 */
const detectInboundLanguage = (text = '', { exclude = [] } = {}) => {
  let s = String(text || '');
  for (const token of exclude) {
    if (token) s = s.split(token).join(' ');
  }
  if (/[\u0900-\u097F]/.test(s)) return 'hi';
  if (/[\u0980-\u09FF]/.test(s)) return 'bn';
  const hasArabicScript = /[\u0600-\u06FF]/.test(s);
  if (hasArabicScript && (/[\u0679\u0688\u0691\u06BA\u06D2]/.test(s) || URDU_WORDS.test(s))) return 'ur';
  if (hasArabicScript && URDU_LETTERS.test(s) && /[\u06CC\u06C1\u06BE]/.test(s) && !/[\u064A\u0629]/.test(s)) {
    return 'ur';
  }

  const latinWords = (s.toLowerCase().match(/[a-z][a-z'0-9]*/g) || []).filter((w) => w.length > 1 || w === 'i');
  const english = latinWords.filter((w) => COMMON_ENGLISH.has(w)).length;
  const arabizi = latinWords.filter((w) => ARABIZI_TOKENS.has(w)).length;

  if (hasArabicScript) return english >= 2 ? 'mixed' : 'ar';
  if (arabizi >= 2 || (arabizi === 1 && latinWords.length <= 2)) return 'arabizi';
  if (latinWords.length) return 'en';
  return 'none';
};

/** Which languages to render, in order. */
const renderModeFor = (language, storedMode = []) => {
  switch (language) {
    case 'en':
      return ['en'];
    case 'ar':
      return ['ar'];
    case 'mixed':
    case 'arabizi':
      return ['ar', 'en'];
    case 'ur':
    case 'hi':
    case 'bn':
      return ['en', 'ar'];
    default:
      return Array.isArray(storedMode) && storedMode.length ? storedMode : ['ar', 'en'];
  }
};

// ---------------------------------------------------------------------------
// Reference extraction
// ---------------------------------------------------------------------------

const UPPERCASE_STOPWORDS = new Set(
  `HELLO PLEASE THANKS THANK DRIVER RIDER URGENT LLBOX ORDER NUMBER PARCEL PACKAGE CUSTOMER DELIVERY
  DELIVERED ADDRESS LOCATION OUTSIDE BROTHER SALAM ASAP TRACKING REFERENCE CODE HELP WHERE TODAY
  AMAZON NOON SHEIN ARAMEX SMSA ARRIVED WAITING STREET VILLA BUILDING`
    .split(/\s+/)
    .filter(Boolean)
);

const WORD_STOPWORDS = new Set(
  `one-time drop-off pick-up pickup follow-up check-in e-mail wi-fi re-send t-shirt walk-in
  check-out sign-up log-in x-ray`
    .split(/\s+/)
    .filter(Boolean)
);

const REF_KEYWORD = /^(order|orders|ref|reference|tracking|track|awb|shipment|consignment|waybill|parcel|no|no\.|number|num|#|رقم|الطلب|طلب|التتبع|الشحنة|آرڈر|نمبر)$/i;
const STRONG_REF_KEYWORD = /^(order|ref|reference|tracking|awb|shipment|waybill|#|رقم|الطلب|التتبع)$/i;
const CODE_KEYWORD = /^(code|codes|otp|pin|password|passcode|كود|رمز|الرمز|الكود)$/i;
const FILLER = /^(is|was|the|my|a|an|:|-|=|this|it's|its|هو|هي)$/i;

const tokenize = (text) =>
  String(text || '')
    .split(/[\s,;،؛()[\]{}"“”'‘’<>]+/)
    .map((t) => t.trim())
    .filter(Boolean);

const cleanToken = (t) => String(t || '').replace(/^[#:.\-_/]+/, '').replace(/[.:!?؟\-_/]+$/, '');

const DATE_LIKE = /^(20\d{2}-\d{1,2}-\d{1,2}|\d{1,2}[/.]\d{1,2}([/.]\d{2,4})?)$/;
const DIM_LIKE = /^\d{1,3}(\.\d)?(cm)?[x×*]\d{1,3}(\.\d)?(cm)?([x×*]\d{1,3}(\.\d)?(cm)?)?(cm)?$/i;
// Short words that start a spaced reference only by accident ("flat 12 554433", "bldg 4 ...").
const PREFIX_DENY = new Set(
  `is at my no the box gate flat room door apt floor unit bldg blk st rd ave lvl km min mins am pm sar sr rs cm kg
  hai he ka ki ke ko se me pe par mera meri bhai sir bro and or for its her his our pls plz ok in on to of by up
  we u ur hi yo ya da la wa ana fi al el ref awb ord num nr tel mob ph call otp pin code
  raha rahi rha kya nahi nhi nai abhi yeh ye woh aur toh hua tha thi cash paid cod`
    .split(/\s+/)
    .filter(Boolean)
);

const isPhoneLike = (raw, clean) => {
  if (/^\+/.test(raw)) return true;
  const digits = clean.replace(/\D/g, '');
  if (digits !== clean.replace(/[-\s]/g, '')) return false;
  return /^(00)?9665\d{8}$/.test(digits) || /^05\d{8}$/.test(digits);
};

/**
 * Extract reference candidates as typed (punctuation inside kept, surrounding stripped).
 * @returns {{ candidates: string[], tooShort: string|null, junk: boolean }}
 */
const extractReferences = (text = '') => {
  const s = String(text || '').trim();
  const out = [];
  const seen = new Set();
  const push = (ref) => {
    const key = refKey(ref);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(ref);
  };

  // Whole message is only digit / dash / space groups → look up as typed (Amazon 171-2345678-9012345)
  const compact = s.replace(/^[#\s]+|[.\s!?]+$/g, '');
  if (/^[0-9][0-9\s\-]*[0-9]$/.test(compact) && /[\s\-]/.test(compact) && !DATE_LIKE.test(compact)) {
    const digits = compact.replace(/\D/g, '');
    if (digits.length >= 6 && digits.length <= 30 && !isPhoneLike(compact, compact)) {
      return { candidates: [compact.replace(/\s+/g, ' ')], tooShort: null, junk: false };
    }
  }

  const tokens = tokenize(s);
  let tooShort = null;
  let junk = false;
  // "HELLO???? ANYONE THERE": in an all-caps message, a letters-only word is a reference only after "order"/"ref".
  const words = s.match(/[A-Za-z]{3,}/g) || [];
  const shouting = words.length >= 2 && words.every((w) => w === w.toUpperCase());

  for (let i = 0; i < tokens.length; i += 1) {
    const raw = tokens[i];
    const clean = cleanToken(raw);
    if (!clean) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9\-_/.]*$/.test(clean)) continue;

    const alnum = clean.replace(/[^A-Za-z0-9]/g, '');
    if (alnum.length > 40) {
      junk = true;
      continue;
    }

    const prev = cleanToken(tokens[i - 1] || '');
    const prev2 = cleanToken(tokens[i - 2] || '');
    const afterCode = CODE_KEYWORD.test(prev) || (FILLER.test(prev) && CODE_KEYWORD.test(prev2));
    if (afterCode) continue;
    const afterRefWord = REF_KEYWORD.test(prev) || (FILLER.test(prev) && REF_KEYWORD.test(prev2));
    const afterStrongRefWord =
      STRONG_REF_KEYWORD.test(prev) ||
      ((FILLER.test(prev) || /^number$/i.test(prev)) && STRONG_REF_KEYWORD.test(prev2));

    const hasDigit = /\d/.test(clean);
    const hasLetter = /[A-Za-z]/.test(clean);

    if (alnum.length < 6) {
      if (hasDigit && (afterRefWord || tokens.length === 1)) tooShort = tooShort || clean;
      continue;
    }
    if (/^(.)\1+$/i.test(alnum)) {
      junk = true;
      continue;
    }
    if (/BOX/i.test(clean) || /^LLBOX/i.test(clean)) continue;
    if (WORD_STOPWORDS.has(clean.toLowerCase())) continue;
    if (isPhoneLike(raw, clean)) continue;
    if (DATE_LIKE.test(clean) || DIM_LIKE.test(clean)) continue;

    if (hasDigit) {
      push(clean);
      continue;
    }
    if (!hasLetter) continue;

    const typedUpper = clean === clean.toUpperCase();
    if (typedUpper && !UPPERCASE_STOPWORDS.has(clean.toUpperCase()) && alnum.length >= 6 && (!shouting || afterRefWord)) {
      push(clean);
      continue;
    }
    if (
      afterStrongRefWord &&
      !UPPERCASE_STOPWORDS.has(clean.toUpperCase()) &&
      !COMMON_ENGLISH.has(clean.toLowerCase())
    ) {
      push(clean);
    }
  }

  // Reference typed in groups after "order"/"ref"/"#" ("order SPL 99 554433", "my order is ord 12828 13")
  // → keep as typed, replacing any single group already picked up from it.
  for (let i = 0; i < tokens.length; i += 1) {
    const prev = cleanToken(tokens[i - 1] || '');
    const prev2 = cleanToken(tokens[i - 2] || '');
    const afterStrong = STRONG_REF_KEYWORD.test(prev) || (FILLER.test(prev) && STRONG_REF_KEYWORD.test(prev2));
    if (!afterStrong) continue;
    const group = [];
    for (let j = i; j < tokens.length && group.length < 5; j += 1) {
      const tok = cleanToken(tokens[j]);
      const lower = tok.toLowerCase();
      if (!/^[A-Za-z0-9\-]{1,12}$/.test(tok) || COMMON_ENGLISH.has(lower) || WORD_STOPWORDS.has(lower) || /box/i.test(tok)) break;
      if (group.length && !/\d/.test(tok) && !/^[A-Z]{1,4}$/.test(tok)) break;
      group.push(tok);
    }
    const joined = group.join('');
    if (group.length >= 2 && /\d/.test(joined) && /^[A-Za-z0-9\-]{6,30}$/.test(joined) && !isPhoneLike(joined, joined)) {
      const groupKey = refKey(joined);
      for (let k = out.length - 1; k >= 0; k -= 1) {
        if (groupKey.includes(refKey(out[k]))) {
          seen.delete(refKey(out[k]));
          out.splice(k, 1);
        }
      }
      push(group.join(' '));
      out.unshift(out.pop());
      tooShort = null;
      break;
    }
  }

  // Spaced reference without a keyword (R3): "spl 88 123456", "JT 0001 2345" → one reference as typed.
  for (let i = 0; i < tokens.length; i += 1) {
    const head = cleanToken(tokens[i]);
    const lower = head.toLowerCase();
    if (!/^[A-Za-z]{2,4}$/.test(head) || PREFIX_DENY.has(lower) || COMMON_ENGLISH.has(lower)) continue;
    if (ARABIZI_TOKENS.has(lower) || REF_KEYWORD.test(head) || CODE_KEYWORD.test(head)) continue;
    const prev = cleanToken(tokens[i - 1] || '');
    if (CODE_KEYWORD.test(prev)) continue;
    const group = [head];
    for (let j = i + 1; j < tokens.length && group.length < 5; j += 1) {
      const tok = cleanToken(tokens[j]);
      if (!/^\d{1,12}[A-Za-z]?$/.test(tok) || DIM_LIKE.test(tok)) break;
      group.push(tok);
    }
    if (group.length < 2) continue;
    const joined = group.join('');
    const digitCount = joined.replace(/\D/g, '').length;
    if (digitCount < 5 || joined.length < 6 || joined.length > 30 || isPhoneLike(joined, joined)) continue;
    const groupKey = refKey(joined);
    if (out.some((r) => refKey(r) === groupKey || refKey(r).includes(groupKey))) continue;
    for (let k = out.length - 1; k >= 0; k -= 1) {
      if (groupKey.includes(refKey(out[k]))) {
        seen.delete(refKey(out[k]));
        out.splice(k, 1);
      }
    }
    push(group.join(' '));
    out.unshift(out.pop());
    tooShort = null;
    break;
  }

  if (!out.length && !tooShort) {
    const only = cleanToken(compact);
    if (/^[A-Za-z0-9\-]{1,5}$/.test(only) && /\d/.test(only)) tooShort = only;
  }

  return { candidates: out, tooShort: out.length ? null : tooShort, junk: !out.length && junk };
};

/** order_reference line from the vision OCR block; send what was read, as read. */
const extractOcrReference = (mediaContext = '') => {
  const ctx = String(mediaContext || '');
  if (!ctx || /^MEDIA_READ_FAILED/i.test(ctx)) return '';
  const line = ctx.match(/order_reference\s*:\s*([^\n\r]+)/i);
  if (line) {
    const value = String(line[1])
      .trim()
      .replace(/^(tracking|order|number|#)\s*[:\-]?\s*/i, '')
      .replace(/[^A-Za-z0-9_\-\s]/g, '')
      .trim();
    if (
      refKey(value).length >= 6 &&
      !/^(N\/?A|NONE|NULL|UNKNOWN|NOT\s*_?VISIBLE)$/i.test(value)
    ) {
      return value;
    }
  }
  const { candidates } = extractReferences(normalizeInbound(ctx));
  return candidates[0] || '';
};

// ---------------------------------------------------------------------------
// Intent classification (rules first)
// ---------------------------------------------------------------------------

// Roman Hindi / Urdu negation ("nahi chal raha", "khul nahi raha")
const NAHI = '(?:nahi|nahin|nahee|nhi|nai|na)';

const RX = {
  codeNotWorking: [
    /\b(code|otp|pin|password|keypad)\b[^.?!\n]{0,40}\b(not|isn'?t|doesn'?t|didn'?t|won'?t|wont|wrong|invalid|fail(?:ed|s|ing)?|error|nahi|nhi|mafi)\b/,
    /\b(box|lid|locker)\b[^.?!\n]{0,20}\b(won'?t|wont|not|doesn'?t|didn'?t|isn'?t|is\s*not)\s*(open|opening)\b/,
    /\bnot\s*(opening|unlocking)\b/,
    /\b(box|locker|keypad|screen)\b[^.?!\n]{0,20}\b(dead|not\s*respond(ing)?|no\s*power|(switched|turned|powered)\s*off|blank|not\s*turning\s*on)\b/,
    /\bno\s*beep\b/,
    new RegExp(`\\b(code|otp|pin)\\b[^.?!\\n]{0,30}\\b${NAHI}\\b[^.?!\\n]{0,15}\\b(chal|chl|lag|kaam|work|khul|open|ho|accept)\\w*`),
    new RegExp(`\\b(code|otp|pin)\\b[^.?!\\n]{0,20}\\bkaam\\s*${NAHI}\\b`),
    /\b(code|otp)\b[^.?!\n]{0,20}\b(galat|ghalat)\b/,
    new RegExp(`\\b(box|dabba|lock|locker|lid|dhakkan)\\b[^.?!\\n]{0,20}\\b${NAHI}\\s*(khul|khol|open)\\w*`),
    new RegExp(`\\b(khul|khol)\\s*${NAHI}\\s*(raha|rahi|rha|rhi|ho|hua|paa?|sakta)\\b`),
    new RegExp(`\\b(light|batti|display|screen|keypad)\\b[^.?!\\n]{0,15}\\b${NAHI}\\s*(jal|aa|chal|on|dikh)\\w*`),
    /\b(box|dabba|machine|locker)\b[^.?!\n]{0,20}\b(band\s*(pada|padi|ho\s*gaya|hogaya|ho\s*gayi)|(dead|kharab|khrab|kharaab)\s*(pada|padi|hai|ho\s*gaya|hogaya|ho\s*gayi))\b/,
    new RegExp(`\\b${NAHI}\\s*(khul|khol)\\s*(raha|rahi|rha|rhi|hua|paa?|sakta|ta)\\b`),
    /(الرمز|الكود|رمز|كود)[^.؟!\n]{0,25}(لا يعمل|ما يشتغل|مايشتغل|ما اشتغل|غلط|خطأ|خربان)/,
    /(الصندوق|الغطاء|البوكس)[^.؟!\n]{0,15}(لا يفتح|ما يفتح|مايفتح|ما انفتح|ما فتح|طافي|ما يستجيب|لا يستجيب)/,
  ],
  boxFull: [
    /\b(box|locker)\b[^.?!\n]{0,15}\b(is\s*)?(full|packed)\b/,
    /\bno\s*(space|room)\b/,
    /\b(box|dabba)\b[^.?!\n]{0,10}\b(bhara|bhar\s*gaya|bhar\s*gya)\b/,
    new RegExp(`\\b(jagah|jaga|space)\\s*${NAHI}\\b`),
    /(الصندوق|البوكس)[^.؟!\n]{0,10}(ممتلئ|مليان|فل)/,
    /(ما في|مافي|لا يوجد) مكان/,
  ],
  parcelTooLarge: [
    /\btoo\s*(big|large|huge)\b/,
    /\b(doesn'?t|does\s*not|dont|don'?t|do\s*not|won'?t|wont|can'?t|cannot|not|isn'?t)\s*fit(ting)?\b/,
    /\b(kbeer|kbir|kabeer)\b/,
    /\bm(sh|ish|ush)\s*y[ao]?dkhol\b/,
    /\b(bahut|bohot|zyada|jyada)\s*(bada|bara|badaa)\b/,
    /\b(bada|bara|badaa)\s*(hai|he|h)\b/,
    new RegExp(`\\bfit\\s*${NAHI}\\b|\\b${NAHI}\\s*fit\\b`),
    new RegExp(`\\b(andar|ander)\\s*${NAHI}\\s*(ja|jaa|aa|ghus|sama|samaa)\\w*`),
    new RegExp(`\\b${NAHI}\\s*(ja|aa|ghus)\\s*(raha|rahi|rha)\\b[^.?!\\n]{0,10}\\b(andar|ander)\\b`),
    /\bbox\s*(chhota|chota|chhoti|choti)\b/,
    /(ما يدخل|مايدخل|لا يدخل|لا يتسع|ما يتسع|كبير)/,
  ],
  cannotFindBox: [
    /\b(can'?t|cannot|could\s*not|couldn'?t|unable\s*to|not\s*able\s*to|don'?t|didn'?t)\s*(find|see|locate)\b/,
    /\bno\s*box\b/,
    /\bmafi\s*(al\s*)?box\b/,
    /\bbox\b[^.?!\n]{0,10}\b(not\s*(there|here|visible)|missing)\b/,
    /\bgate\b[^.?!\n]{0,12}\b(closed|locked|shut|band|bandh)\b/,
    new RegExp(`\\b(box|location|address|ghar|makan)\\b[^.?!\\n]{0,15}\\b${NAHI}\\s*(mil|dikh|mila|dikha)\\w*`),
    new RegExp(`\\b${NAHI}\\s*(mil|dikh)\\s*(raha|rahi|rha|rhi)\\b`),
    /(ما في|مافي|لا يوجد) (صندوق|بوكس)/,
    /(ما لقيت|مالقيت|لا أجد|لم أجد|ما حصلت)/,
    /(البوابة|الباب) (مقفلة|مغلقة|مقفل|مغلق)/,
  ],
  customerNoAnswer: [
    /\b(not|no|isn'?t|doesn'?t|didn'?t|is\s*not)\s*(answer(ing)?|repl(y|ying)|respond(ing)?|picking)\b/,
    /\bno\s*(answer|response|reply)\b/,
    new RegExp(`\\b(phone|call|fon)\\b[^.?!\\n]{0,15}\\b${NAHI}\\s*(utha|uthaa|uth|receive|le)\\w*`),
    new RegExp(`\\b(jawab|reply|response)\\s*${NAHI}\\b`),
    new RegExp(`\\bkoi\\s*(bhi\\s*)?${NAHI}\\s*(hai|he|h|mila|aaya)\\b`),
    new RegExp(`\\bghar\\s*(pe|par)\\s*${NAHI}\\b`),
    /(ما يرد|لا يرد|مايرد|ما رد|لا يجيب)/,
  ],
  contactRequest: [
    /\b(customer|client|recipient|owner)'?s?\b[^.?!\n]{0,20}\b(phone|number|mobile|contact|whatsapp)\b/,
    /\b(phone|mobile|contact|whatsapp)\s*(number\s*)?(of|for)\s*(the\s*)?(customer|client|recipient)\b/,
    /\bcall\s*(the\s*)?(customer|client|him|her)\b/,
    /\b(customer|client)\s*(ka|ki|ke)\s*(number|phone|mobile|no)\b/,
    /رقم (العميل|الزبون|جواله|جوال العميل|هاتف العميل)/,
  ],
  offBox: [
    /\b(guard|security|watchman|chowkidar|haris|bawab|reception|receptionist|concierge|neighbou?r|doorman)\b/,
    /\bleave\s*(it|the\s*parcel|the\s*package)?\s*(at|by|outside|in\s*front\s*of)\s*(the\s*)?(gate|door|doorstep|entrance)\b/,
    /\bno\s*need\s*(for\s*)?(the\s*)?box\b/,
    /\b(bahar|bahr)\s*(rakh|chhod|chod)\w*/,
    /\b(gate|darwaza|door)\s*(pe|par)\s*(rakh|chhod|chod)\w*/,
    /(الحارس|الأمن|البواب|الجار|عند الباب|عند البوابة)/,
  ],
  // Intentional COD request only — never from a pasted label field like "COD: NO" (acceptance D37).
  codRequest: [
    /\bcash\s*on\s*delivery\b/,
    /\b(collect|take|get|receive|need\s*to\s*collect)\b[^.?!\n]{0,20}\b(cash|cod|payment|money|amount)\b/,
    /\b(cash|cod)\b[^.?!\n]{0,20}\b(collect|lena|leni|lene|baaki|baki|pending|due)\b/,
    /\b(this\s*(is|order\s*is)|order\s*is|its|it's)\s*(a\s*)?(cod|cash\s*on\s*delivery)\b/,
    /\bcod\s*(order|delivery|payment|please|hai|he|he\s*hai)\b/,
    /\b(customer|client)\b[^.?!\n]{0,20}\b(has\s*to|must|needs?\s*to|will|should)\s*pay\b/,
    /\b(payment|paisa|paise|paisay|pese)\s*(lena|leni|lene|collect|baaki|baki|pending|due)\b/,
    /\bpayment\s*(pending|due|not\s*(done|paid|made))\b/,
    /\bnot\s*(prepaid|paid\s*yet)\b/,
    /\bpay\s*(on|at)\s*(delivery|the\s*door)\b/,
    /(الدفع عند الاستلام|استلام المبلغ|أستلم المبلغ|تحصيل المبلغ|ادفع عند|يدفع عند|كاش عند الاستلام)/,
  ],
  // Label / speech that means there is no cash to collect.
  codNegated: [
    /\bcod\s*[:\-–]?\s*(no|n|false|0|paid|prepaid|nil|none)\b/,
    /\b(no|not|without|non)\s*[-:]?\s*(a\s*|any\s*)?(cod|cash(\s*on\s*delivery)?)\b/,
    /\b(prepaid|already\s*paid|paid\s*already|payment\s*(done|received|complete))\b/,
    /\bno\s*cash\b/,
    /(مدفوع مسبقا|مدفوع مسبقًا|بدون كود|بدون كاش|مش كاش|مو كاش|ليس كاش)/,
  ],
  selfDriver: [
    /\b(i\s*am|i'm|im)\s*(the\s*|a\s*|your\s*)?(driver|courier|rider|delivery\s*(guy|man|boy|driver))\b/,
    /\b(i\s*am|i'm|im)\s*(here\s*)?(to\s*)?(deliver(ing)?|drop(ping)?\s*off)\b/,
    /\bdriver\s*here\b/,
    /(أنا|انا) (السائق|المندوب|سواق|مندوب|سائق)/,
  ],
  completionClaim: [
    /\b(delivery|order|parcel|package|job)\b[^.?!\n]{0,15}\b(completed?|done|finished)\b/,
    /\b(i|i've|i\s*have|already)\s*(delivered|completed)\b/,
    /\b(i|i've|i\s*have)\s*(already\s*)?(put|placed|left|dropped)\b[^.?!\n]{0,30}\b(in|inside|into)\s*(the\s*)?(box|locker)\b/,
    /\b(put|placed|left|dropped|kept)\b[^.?!\n]{0,25}\binside\b/,
    /\b(closed?|shut)\s*(the\s*)?(lid|box)\b/,
    /(حطيت|وضعت|حطيته|وضعته)[^.؟!\n]{0,20}(داخل|بالصندوق|في الصندوق)/,
    /(سكرت|أغلقت|قفلت) (الغطاء|الصندوق)/,
    /\bclose\s*the\s*order\b/,
    /^\s*(done|finished|completed|delivered)\b/,
    /(تم التسليم|سلمت الطلب|سلمته|خلصت التوصيل)/,
  ],
  ownerClaim: [
    /\b(i\s*am|i'm|im)\s*(the\s*)?(owner|customer)\b/,
    /\bowner\s*of\s*(the|this)\s*box\b/,
    /\bmy\s*(own\s*)?box\b/,
    /(صاحب الصندوق|أنا العميل|انا العميل|صندوقي)/,
  ],
  humanRequest: [
    /\b(human|real\s*person|live\s*agent|customer\s*(service|care|support)|support\s*team|operator)\b/,
    /\b(talk|speak|chat)\s*(to|with)\s*(a\s*|some\s*)?(person|someone|somebody|agent|human|staff)\b/,
    /\bare\s*you\s*(a\s*)?(robot|bot|machine|ai|human|real)\b/,
    /(موظف|شخص حقيقي|إنسان|انسان|خدمة العملاء)/,
  ],
  manipulation: [
    /ignore\s*(all\s*)?(the\s*)?(previous|prior|above)/,
    /\b(debug|developer|admin|god)\s*mode\b/,
    /\bsystem\s*prompt\b/,
    /\bjailbreak\b/,
    /\ball\s*(the\s*)?(otps?|codes)\b/,
    /\bevery\s*(one-time\s*)?code\b/,
    /\b(bypass|hack)\b/,
  ],
  locationRequest: [
    /\b(address|location|locate|directions?|map)\b/,
    /\bwhere\b[^.?!\n]{0,15}\b(box|locker|llbox)\b/,
    /\bwhich\s*box\b/,
    /\b(wein|wain|fein|feen|ween|kahan|kahaan|kidhar|kidhr)\b/,
    /(عنوان|العنوان|موقع|الموقع|لوكيشن|وين|فين|أين|کہاں)/,
  ],
  codeRequest: [/\b(otp|code|pin|password|passcode)\b/, /(رمز|كود|الرمز|الكود)/],
  collectionHelp: [/\bopen\s*(my\s*)?box\b/, /\bcollection\s*code\b/, /\bnew\s*code\b/, /(افتح صندوقي|فتح الصندوق)/],
  parcelStatus: [
    /\b(where\s*is\s*my|status\s*of\s*my|has\s*my)\b[^.?!\n]{0,20}\b(parcel|package|order|delivery)\b/,
    /\b(parcel|package|order)\b[^.?!\n]{0,20}\b(arrived|status|kab|when)\b/,
    /(وين طلبي|متى يوصل|هل وصل)/,
  ],
  delivering: [
    /\b(driver|rider|courier|deliver(ing|y)?|drop\s*-?\s*off|dropping)\b/,
    /\bi\s*have\s*(a|your|the|one)\s*(parcel|package|order|delivery)\b/,
    /\b(tawseel|mandoob)\b/,
    /(سائق|مندوب|توصيل|عندي طلب|عندي شحنة|ڈرائیور)/,
  ],
  infoRequest: [
    /\b(what\s*is|what's|whats)\s*(this|llbox|ll\s*box|it)\b/,
    /\btell\s*me\s*(more\s*)?about\b/,
    /\b(know|learn)\s*more\b/,
    /\bmore\s*info\b/,
    /\bhow\s*(does|do)\s*(it|llbox|this)\s*work\b/,
    /^\s*(know\s*more|info|2)\s*$/,
    /(ما هو|ماهو|معرفة المزيد|كيف يعمل)/,
  ],
  greetingOnly: [
    /^(hi+|hello+|hey+|hiya|salam|salaam|slm|assalam(u|o)?\s*(a?alaikum|alaykum)?|as-?salamu?\s*alaykum|marhaba|ahlan|good\s*(morning|afternoon|evening)|yo)([\s!.,]+(hi+|hello+|there|sir|brother|bro|habibi))*[\s!.,]*$/,
    /^(مرحبا|مرحباً|السلام عليكم|سلام|هلا|اهلا|أهلا|صباح الخير|مساء الخير)[\s!.,،]*$/,
  ],
  yes: [/^\s*(yes|yeah|yep|y|ok|okay|sure|delivery|deliver|drop\s*off|1|نعم|ايوه|أيوه|aiwa|aywa|na3am)\s*[.!]*$/],
  thanks: [
    /^\s*((ok|okay|k|done|great|good)[\s,!.]*)?(thanks?|thank\s*you|thx|thnx|tnx|ty|shukran|shokran|jazak\s*allah|jazakallah)([\s,!.]+(so\s*much|a\s*lot|very\s*much|bro|brother|sir|habibi|boss))*[\s!.]*$/,
    /^\s*(شكرا|شكرًا|شكراً|مشكور|يعطيك العافية|تسلم|جزاك الله خير)[\s!.،]*$/,
  ],
};

const matches = (list, text) => list.some((rx) => rx.test(text));

/** Primary stuck issue (one notify per turn) — priority order per report §5.4. */
const STUCK_PRIORITY = ['code_not_working', 'parcel_too_large', 'box_full', 'cannot_find_box', 'other'];

const classifyInbound = (normalizedText = '') => {
  const t = String(normalizedText || '').toLowerCase();
  const issues = [];
  if (matches(RX.codeNotWorking, t)) issues.push('code_not_working');
  if (matches(RX.parcelTooLarge, t)) issues.push('parcel_too_large');
  if (matches(RX.boxFull, t)) issues.push('box_full');
  if (matches(RX.cannotFindBox, t)) issues.push('cannot_find_box');
  const ownerClaim = matches(RX.ownerClaim, t);
  const manipulation = matches(RX.manipulation, t);
  const contactRequest = !ownerClaim && !manipulation && matches(RX.contactRequest, t);
  const offBox = matches(RX.offBox, t);
  const customerNoAnswer = matches(RX.customerNoAnswer, t);
  if (contactRequest || offBox || customerNoAnswer) issues.push('other');

  const stuckIssue = STUCK_PRIORITY.find((i) => issues.includes(i)) || null;

  return {
    issues,
    stuckIssue,
    contactRequest,
    offBox,
    customerNoAnswer,
    completionClaim: matches(RX.completionClaim, t),
    ownerClaim,
    humanRequest: matches(RX.humanRequest, t),
    manipulation,
    locationRequest: matches(RX.locationRequest, t),
    codeRequest: matches(RX.codeRequest, t),
    collectionHelp: matches(RX.collectionHelp, t),
    parcelStatus: matches(RX.parcelStatus, t),
    delivering: matches(RX.delivering, t),
    infoRequest: matches(RX.infoRequest, t),
    greetingOnly: matches(RX.greetingOnly, t),
    yes: matches(RX.yes, t),
    thanks: matches(RX.thanks, t),
    // Pasted labels often contain "COD: NO" / "COD: YES"; only intentional requests start the COD flow.
    codRequest: matches(RX.codRequest, t) && !matches(RX.codNegated, t),
    codNegated: matches(RX.codNegated, t),
    selfDriver: matches(RX.selfDriver, t),
    damagedLabel: /label\s*(is\s*)?(torn|damaged|missing|wet|faded|kharab)|can'?t\s*read|cannot\s*read|number\s*nahi|no\s*order\s*number|الملصق (ممزق|تالف)/.test(t),
  };
};

// ---------------------------------------------------------------------------
// Box owner intent (intent first, reference second — Test Report 2026-10-04 F1/F3)
// ---------------------------------------------------------------------------

const DRIVER_WORD = /\b(driver|courier|rider|delivery\s*(guy|man|boy)|mandoob)\b|(السائق|سائق|المندوب|مندوب|السواق)/;

const OWNER_RX = {
  optOut: [
    /^\s*(stop|unsubscribe|opt\s*-?\s*out)\s*[.!]*$/,
    /\bstop\s*(sending|messaging|texting)\b/,
    /\b(don'?t|do\s*not|never)\s*(message|text|send\s*me\s*(any\s*)?(more\s*)?messages?|contact)\s*me\b/,
    /\bno\s*more\s*messages\b/,
    /\bmessages?\s*(band|bund)\s*(karo|kar\s*do|kardo)\b/,
    /(أوقف|اوقف|إيقاف|ايقاف|توقف عن)\s*(الرسائل|إرسال|ارسال)/,
    /لا (ترسل|تراسل)ني|لا ترسل لي/,
  ],
  optIn: [
    /^\s*(start|resume|unstop|subscribe)\s*[.!]*$/,
    /\b(start|resume|turn\s*on)\s*(sending\s*)?(the\s*)?messages\b/,
    /(فعّل|فعل|شغل|أعد|اعد)\s*(تفعيل\s*)?الرسائل/,
  ],
  driverContactOff: [
    /\b(don'?t|do\s*not|never|stop)\s*(give|giving|share|sharing|send|sending)\b[^.?!\n]{0,30}\b(number|phone)\b[^.?!\n]{0,25}\b(drivers?|couriers?)\b/,
    /\b(drivers?|couriers?)\b[^.?!\n]{0,20}\b(can'?t|cannot|should\s*not|shouldn'?t|must\s*not|mustn'?t)\s*(call|contact|have|get)\b/,
    /\b(don'?t|do\s*not)\s*(let|allow)\s*(the\s*)?(drivers?|couriers?)\s*(to\s*)?(call|contact)\b/,
    /\b(don'?t|do\s*not)\s*want\s*(the\s*)?(drivers?|couriers?)\s*(to\s*)?(call|calling|contact|having)\b/,
    /(لا|ما)\s*(تعطي|تعط|تشارك|تعطون)\s*(رقمي|جوالي)/,
    /(لا|ما)\s*(يتصل|يكلمني|يتصلون)\s*(بي\s*)?(السائق|السواق|المندوب)/,
  ],
  driverContactOn: [
    /\b(drivers?|couriers?)\s*(can|may|are\s*allowed\s*to)\s*(call|contact|phone)\s*me\b/,
    /\b(let|allow)\s*(the\s*)?(drivers?|couriers?)\s*(to\s*)?(call|contact)\s*me\b/,
    /\b(share|give)\s*my\s*(number|phone)\s*(with|to)\s*(the\s*)?(drivers?|couriers?)\b/,
    /(اسمح|خل|خلي)\s*(للسائق|السائق|السواق|المندوب)\s*(يتصل|يكلم)/,
  ],
  accountChange: [
    /\b(add|invite)\b[^.?!\n]{0,20}\b(member|family\s*member|wife|husband|son|daughter|brother|sister|mother|father|flatmate|housemate|person|user|someone)\b/,
    /\b(change|update|new)\b[^.?!\n]{0,15}\b(my\s*)?(phone|mobile|whatsapp)\s*(number)?\b/,
    /\bchange\s*(my\s*)?number\b/,
    /\b(delete|close|remove|deactivate)\b[^.?!\n]{0,10}\b(my\s*)?account\b/,
    /\b(change|update)\b[^.?!\n]{0,15}\b(my\s*)?(address|email|name)\b/,
    /(احذف|حذف|إلغاء|الغاء|اقفل|أقفل)\s*(حسابي|الحساب)/,
    /(تغيير|غير|غيّر|تحديث|حدث)\s*(رقمي|الرقم|جوالي|رقم الجوال|العنوان|عنواني|الإيميل|اسمي)/,
    /(إضافة|اضافة|أضف|اضف|ضيف)\s*(عضو|فرد|زوجتي|زوجي|ولدي|بنتي|اخوي|أخوي|شخص)/,
  ],
  theft: [
    /\b(stolen|stole|theft|thief|robbed|someone\s*took)\b/,
    /\b(parcel|package|order|item)\b[^.?!\n]{0,20}\b(missing|gone|disappeared)\b/,
    /\bmissing\s*(parcel|package|item)\b/,
    /(سرق|سرقة|مسروق|انسرق|اختفى|مفقود|ضاع الطرد)/,
  ],
  damaged: [
    /\b(parcel|package|item|order|delivery|contents?)\b[^.?!\n]{0,20}\b(damaged|broken|crushed|wet|torn|smashed|dented)\b/,
    /\b(damaged|broken|crushed|wet|smashed)\s*(parcel|package|item|order)\b/,
    /(الطرد|الشحنة|الطلب)[^.؟!\n]{0,10}(تالف|مكسور|متضرر|مبلول|مكسر)/,
  ],
  boxFault: [
    /\bred\s*light\b/,
    /\b(box|locker|lid|keypad|screen)\b[^.?!\n]{0,25}\b(broken|damaged|stuck|jammed|dead|faulty|beeping|no\s*power|not\s*working|isn'?t\s*working|doesn'?t\s*work|won'?t\s*(open|close|lock)|not\s*(opening|closing|locking)|can'?t\s*(open|close))\b/,
    /\b(battery)\b[^.?!\n]{0,15}\b(dead|low|empty|flat|died)\b/,
    /(الصندوق|البوكس|الغطاء|لوحة المفاتيح)[^.؟!\n]{0,15}(خربان|معطل|عطلان|مكسور|ما يفتح|لا يفتح|ما يقفل|لا يقفل|ما يشتغل|لا يعمل|عالق)/,
    /(ضوء|لمبة|ليت)\s*(أحمر|احمر|حمراء)/,
  ],
  report: [/\b(report|complain|complaint|problem\s*with\s*(my\s*)?box|issue\s*with\s*(my\s*)?box)\b/, /(بلاغ|شكوى|أبلغ عن|ابلغ عن|مشكلة في الصندوق)/],
  codeTrouble: [
    /\b(code|otp|pin)\b[^.?!\n]{0,40}\b(not|isn'?t|doesn'?t|didn'?t|won'?t|wont|wrong|invalid|fail(?:ed|s|ing)?|error|nahi|nhi)\b/,
    /\bnew\s*code\b[^.?!\n]{0,25}\b(driver|courier)\b/,
    /\b(driver|courier)\b[^.?!\n]{0,40}\b(code|can'?t\s*open|cannot\s*open|won'?t\s*open|not\s*open)/,
    /(السائق|المندوب)[^.؟!\n]{0,30}(الرمز|الكود|ما يفتح|لا يفتح|ما فتح)/,
    /(الرمز|الكود)[^.؟!\n]{0,25}(لا يعمل|ما يشتغل|مايشتغل|ما اشتغل|غلط|خطأ)/,
  ],
  guestCode: [
    /\b(send|give|get|need|want|create|generate|make|issue)\b[^.?!\n]{0,20}\b(code|otp|pin)\b/,
    /\bnew\s*code\b/,
    /\bcode\s*(to|for)\s*(open|my|the|a)\b/,
    /\bopen\s*(my\s*|the\s*)?(box|locker)\b/,
    /\b(guest|visitor|cleaner|maid|neighbou?r|family|friend)\b[^.?!\n]{0,20}\bcode\b/,
    /\bcode\b[^.?!\n]{0,20}\b(guest|visitor|cleaner|maid|neighbou?r|friend)\b/,
    /\blost\s*(my\s*|the\s*)?code\b/,
    /\bcode\s*(bhejo|bhej\s*do|do|de\s*do|dedo|chahiye)\b/,
    /(رمز|كود)[^.؟!\n]{0,15}(لفتح|افتح|فتح)/,
    /(افتح|فتح)\s*(صندوقي|الصندوق)/,
    /(أرسل|ارسل|أبي|ابي|ابغى|أبغى|عطني|اعطني|أعطني|أريد|اريد)[^.؟!\n]{0,10}(رمز|كود)/,
    /رمز ضيف/,
  ],
  boxNumber: [
    /\b(what|which)\s*(phone\s*|whatsapp\s*)?number\b[^.?!\n]{0,40}\b(give|use|put|share|tell|enter|write)\b/,
    /\b(box'?s?|my\s*box|llbox)\s*(phone\s*|whatsapp\s*|contact\s*)?number\b/,
    /\bnumber\b[^.?!\n]{0,25}\b(noon|amazon|shein|aramex|smsa|naqel|spl|courier|couriers|delivery\s*company|store|shop)\b/,
    /\b(noon|amazon|shein|aramex|smsa|naqel|courier|delivery\s*company)\b[^.?!\n]{0,30}\b(which|what)\s*number\b/,
    /(أي|اي|وش|ايش|إيش)\s*رقم[^.؟!\n]{0,30}(أعطي|اعطي|أكتب|اكتب|أحط|احط|أستخدم|استخدم)/,
    /رقم\s*(الصندوق|صندوقي)/,
  ],
  boxStatus: [
    /\b(has|did|have)\b[^.?!\n]{0,25}\b(arrive|arrived|come|came|been\s*delivered|delivered)\b/,
    /\b(anything|something|parcel|package)\s*(inside|in\s*(my|the)\s*box)\b/,
    /\bis\s*(my\s*|the\s*)?box\s*(ok|okay|online|working|fine|full|empty|alright)\b/,
    /\b(box|locker)\s*status\b/,
    /\bstatus\s*of\s*(my\s*|the\s*)?box\b/,
    /\b(battery|online|offline|how\s*full)\b/,
    /\b(aaya|aa\s*gaya|aagaya|pahuncha|pahunch\s*gaya)\b/,
    /(هل وصل|وصل الطلب|وصل الطرد|وش في الصندوق|في شي بالصندوق|فيه شي بالصندوق|حالة الصندوق|البطارية|الصندوق شغال)/,
  ],
  list: [
    /\b(where\s*is|where'?s|wheres)\s*(my|the)\s*(parcel|package|order|delivery|shipment|stuff)\b/,
    /\b(show|list|see|check|view|track)\b[^.?!\n]{0,15}\b(my\s*)?(orders|deliveries|parcels|packages|order|delivery)\b/,
    /\bwhat'?s?\s*(is\s*)?(coming|on\s*(the|its)\s*way|expected|registered)\b/,
    /\bmy\s*(orders|deliveries|parcels|packages)\b/,
    /\b(coming|expected|arriving)\s*(this|next)\s*week\b/,
    /\b(mera|meri|mere)\s*(order|parcel|delivery|saman)\b[^.?!\n]{0,15}\b(kahan|kidhar|kab|status)\b/,
    /\b(where\s*is|where'?s|wheres|status\s*(of|for)|track(ing)?|kahan|kidhar|any\s*update\s*on)\b/,
    /(طلباتي|وين طلبي|وين الطلب|وش الطلبات|ايش الطلبات|الطلبات القادمة|اعرض الطلبات|وش جاي|متى يوصل|وين شحنتي|حالة الطلب|^\s*وين\b)/,
  ],
  cancel: [
    /\b(cancel+|cancle|cancell?ation|kansel)\b/,
    /\b(remove|delete|drop|withdraw)\b[^.?!\n]{0,20}\b(order|delivery|parcel|registration|it|that|this|one)\b/,
    /\b(no\s*longer|don'?t|do\s*not)\s*(need|want|expect(ing)?)\b/,
    /(ألغي|الغي|ألغِ|إلغاء|الغاء|ألغ\s+|الغ\s+|كنسل|احذف\s*(الطلب|طلب))/,
  ],
  register: [
    /\bregister\b/,
    /\b(add|new|log|record)\b[^.?!\n]{0,20}\b(delivery|order|parcel|package|shipment)\b/,
    /\b(i'?m|i\s*am)\s*expecting\b/,
    /\bi\s*(have|got|ordered)\s*(an?\s*|one\s*)?(order|parcel|delivery|package|something)\b/,
    /\b(order|parcel|delivery|package)\b[^.?!\n]{0,15}\b(coming|arriving|on\s*the\s*way)\b/,
    /(سجل|سجّل|تسجيل|أضف طلب|اضف طلب|عندي طلب|عندي شحنة|جاني طلب|جاي لي طلب|بيوصلني)/,
  ],
  support: [
    /\b(support|helpline|help\s*line|customer\s*(service|care)|contact\s*(llbox|you|the\s*team|someone))\b/,
    /(الدعم|خدمة العملاء|رقم الدعم|التواصل معكم|أتواصل معكم)/,
  ],
  menu: [
    /^\s*(menu|help|options?|main\s*menu|start\s*over|\?+)\s*[.!]*$/,
    /\b(what|wat|wht)\s*(else\s*)?can\s*(you|u)\s*do\b/,
    /\bhow\s*can\s*(you|u)\s*help\b/,
    /^\s*(القائمة|قائمة|مساعدة|ساعدني)\s*$/,
    /(وش تقدر تسوي|ماذا تستطيع|ايش تقدر|وش تسوي)/,
  ],
  no: [/^\s*(no|nope|nah|not\s*now|no\s*thanks|keep\s*it|لا|لأ|لا شكرا|la)\s*[.!]*$/],
  yes: [/^\s*(yes|yeah|yep|yup|y|ok|okay|sure|please|yes\s*please|confirm|do\s*it|go\s*ahead|correct|نعم|ايوه|أيوه|ايوا|أكيد|اكيد|تمام|aiwa|aywa|na3am|haan|han|ji)\s*[.!]*$/],
  notSure: [
    /\b(not\s*sure|don'?t\s*know|dont\s*know|no\s*idea|dunno|idk|unsure|no\s*clue|not\s*certain)\b/,
    /(مو متأكد|مش متأكد|غير متأكد|ما أدري|ما ادري|لا أعرف|ما اعرف|ما أعرف|مدري)/,
  ],
  prepaid: [/\b(prepaid|pre-paid|already\s*paid|paid\s*(already|online|by\s*card)|it'?s\s*paid|paid)\b/, /(مدفوع|دفعت|مسدد)/],
};

/**
 * Classify a message from a recognised LLBox account. One primary intent, in priority order.
 * @returns {{ intent: string, flags: object }}
 */
const classifyOwnerIntent = (normalizedText = '') => {
  const t = String(normalizedText || '').toLowerCase();
  const m = (key) => matches(OWNER_RX[key], t);
  const flags = {
    driverMention: DRIVER_WORD.test(t),
    cod: matches(RX.codRequest, t) && !matches(RX.codNegated, t),
    prepaid: m('prepaid') || matches(RX.codNegated, t),
    notSure: m('notSure'),
    yes: m('yes'),
    no: m('no'),
    selfDriver: matches(RX.selfDriver, t) && !/\bmy\s*driver\b/.test(t),
    guest: /\b(guest|visitor|cleaner|maid|neighbou?r|friend|myself)\b|رمز ضيف|ضيف/.test(t),
    digit: (t.match(/^\s*([1-9])\s*[.)]?\s*$/) || [])[1] || '',
    manipulation: matches(RX.manipulation, t),
  };
  let issueCategory = '';
  if (m('theft')) issueCategory = 'theft';
  else if (m('damaged')) issueCategory = 'damaged_parcel';
  else if (m('boxFault')) issueCategory = 'box_fault';
  flags.issueCategory = issueCategory;

  const order = [
    // Instruction-override text must never start cancel / register / code flows (acceptance O24).
    ['manipulation', flags.manipulation],
    ['optOut', m('optOut')],
    ['optIn', m('optIn')],
    ['driverContactOff', m('driverContactOff')],
    ['driverContactOn', m('driverContactOn')],
    ['accountChange', m('accountChange')],
    // "red light / no power" is a fault even when a driver is mentioned; a refused code is not.
    ['reportIssue', issueCategory === 'theft' || issueCategory === 'damaged_parcel' ||
      (issueCategory === 'box_fault' && (/\bred\s*light\b|no\s*power|dead|battery|beeping|broken|ضوء|لمبة|خربان|معطل|مكسور/.test(t) || !flags.driverMention))],
    ['replaceCode', m('codeTrouble') || (flags.driverMention && /\b(code|otp|pin|open)\b|رمز|كود|يفتح/.test(t))],
    ['cancel', m('cancel')],
    ['guestCode', m('guestCode')],
    ['boxNumber', m('boxNumber')],
    ['boxStatus', m('boxStatus')],
    ['list', m('list')],
    ['reportIssue', m('report') || Boolean(issueCategory)],
    ['register', m('register')],
    ['support', m('support')],
    ['human', matches(RX.humanRequest, t)],
    ['menu', m('menu')],
    ['info', matches(RX.infoRequest, t) && !/^\s*2\s*$/.test(t)],
    ['thanks', matches(RX.thanks, t)],
    ['greeting', matches(RX.greetingOnly, t)],
  ];
  const hit = order.find(([, ok]) => ok);
  return { intent: hit ? hit[0] : '', flags };
};

/** "60x40x30", "60 x 40 x 30 cm", "60 by 40 by 30" → { length, width, height } in cm, or null. */
const parseDims = (text = '') => {
  const s = String(text || '').toLowerCase();
  const sep = '\\s*(?:cm)?\\s*(?:x|×|\\*|by|,|/|\\s)\\s*';
  const m = s.match(new RegExp(`(?:^|[^\\d.])(\\d{1,3}(?:\\.\\d)?)${sep}(\\d{1,3}(?:\\.\\d)?)${sep}(\\d{1,3}(?:\\.\\d)?)(?![\\d.])`));
  if (!m) return null;
  const [length, width, height] = [m[1], m[2], m[3]].map((n) => Math.round(Number(n)));
  if (![length, width, height].every((n) => n > 0 && n <= 300)) return null;
  return { length, width, height };
};

/** Emoji-only message: what it most likely means. */
const classifyEmojiOnly = (raw = '') => {
  const s = String(raw || '');
  if (!s.trim() || normalizeInbound(s).replace(/[\s.!?؟,]/g, '')) return '';
  if (/[🚚📦🛵🚗🚛🚐]/u.test(s)) return 'delivering';
  if (/[🙏👍👌❤✅😊🙂🤝💯👏]/u.test(s)) return 'thanks';
  return /\p{Extended_Pictographic}/u.test(s) ? 'other' : '';
};

// ---------------------------------------------------------------------------
// Expected delivery day ("tomorrow", "Thursday", "الخميس", "8 Oct", "8/10", "2026-10-08")
// ---------------------------------------------------------------------------

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const WEEKDAY_WORDS = [
  ['sunday', 'sun', 'الأحد', 'الاحد', 'احد'],
  ['monday', 'mon', 'الاثنين', 'الإثنين', 'اثنين'],
  ['tuesday', 'tue', 'tues', 'الثلاثاء', 'الثلاثا', 'ثلاثاء'],
  ['wednesday', 'wed', 'الأربعاء', 'الاربعاء', 'اربعاء'],
  ['thursday', 'thu', 'thur', 'thurs', 'الخميس', 'خميس'],
  ['friday', 'fri', 'الجمعة', 'الجمعه', 'جمعة'],
  ['saturday', 'sat', 'السبت', 'سبت'],
];
const MONTH_WORDS = [
  ['january', 'jan', 'يناير'],
  ['february', 'feb', 'فبراير'],
  ['march', 'mar', 'مارس'],
  ['april', 'apr', 'أبريل', 'ابريل'],
  ['may', 'مايو'],
  ['june', 'jun', 'يونيو'],
  ['july', 'jul', 'يوليو'],
  ['august', 'aug', 'أغسطس', 'اغسطس'],
  ['september', 'sep', 'sept', 'سبتمبر'],
  ['october', 'oct', 'أكتوبر', 'اكتوبر'],
  ['november', 'nov', 'نوفمبر'],
  ['december', 'dec', 'ديسمبر'],
];

const riyadhToday = (nowMs) => {
  const d = new Date(nowMs + RIYADH_OFFSET_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};
const isoDay = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const validDate = (y, m, day) => {
  const d = new Date(Date.UTC(y, m, day));
  return d.getUTCFullYear() === y && d.getUTCMonth() === m && d.getUTCDate() === day ? d : null;
};
const monthIndex = (word) => MONTH_WORDS.findIndex((names) => names.includes(String(word).toLowerCase()));

const MAX_DAYS_AHEAD = 120;
const WORD_NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const addMonths = (d, n) => {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), last)));
};
/** Day + month without a year: this year if within the last 30 days (a past day they named), else the next one. */
const nearest = (today, m, day) => {
  const y = today.getUTCFullYear();
  const d = validDate(y, m, day);
  if (!d) return null;
  if (d >= today || today - d <= 30 * 86400000) return d;
  return validDate(y + 1, m, day);
};

/**
 * Expected delivery day in a message, in Riyadh time.
 * @returns {{ date: string, issue: ''|'past'|'too_far', weekdayToday: boolean, weekday: number|null }}
 *   date is YYYY-MM-DD ('' when no day is mentioned). Expects normalizeInbound() output.
 */
const parseDeliveryDay = (text = '', nowMs = Date.now()) => {
  const t = ` ${String(text).toLowerCase()} `;
  const today = riyadhToday(nowMs);
  const out = (d, extra = {}) => {
    if (!d) return null;
    const diffDays = Math.round((d - today) / 86400000);
    const issue = diffDays < 0 ? 'past' : diffDays > MAX_DAYS_AHEAD ? 'too_far' : '';
    return { date: isoDay(d), issue, weekdayToday: false, weekday: null, ...extra };
  };
  let m;

  if ((m = t.match(/(?:^|[^\d-])(20\d{2})-(\d{1,2})-(\d{1,2})(?![\d-])/))) {
    const r = out(validDate(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (r) return r;
  }
  if ((m = t.match(/(?:^|[\s(])(\d{1,2})[/.](\d{1,2})(?:[/.](20\d{2}|\d{2}))?(?=[\s),!?؟]|$)/))) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    const r = out(year ? validDate(year, Number(m[2]) - 1, Number(m[1])) : nearest(today, Number(m[2]) - 1, Number(m[1])));
    if (r) return r;
  }
  const monthAlt = MONTH_WORDS.flat().sort((a, b) => b.length - a.length).join('|');
  if ((m = t.match(new RegExp(`(?:^|\\s)(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monthAlt})(?:\\s+(20\\d{2}))?(?=[\\s,.!?؟]|$)`)))) {
    const r = out(m[3] ? validDate(Number(m[3]), monthIndex(m[2]), Number(m[1])) : nearest(today, monthIndex(m[2]), Number(m[1])));
    if (r) return r;
  }
  if ((m = t.match(new RegExp(`(?:^|\\s)(${monthAlt})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?(?=[\\s,.!?؟]|$)`)))) {
    const r = out(m[3] ? validDate(Number(m[3]), monthIndex(m[1]), Number(m[2])) : nearest(today, monthIndex(m[1]), Number(m[2])));
    if (r) return r;
  }

  // Relative: "in 6 days", "after 3 days", "in two weeks", "next week", "next month", "بعد 3 أيام"
  const num = '(\\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten)';
  const toN = (w) => (/^\d+$/.test(w) ? Number(w) : WORD_NUMBERS[w]);
  if ((m = t.match(new RegExp(`\\b(?:in|after|within)\\s+${num}\\s+(day|days|week|weeks|month|months)\\b`))) ||
      (m = t.match(new RegExp(`\\b${num}\\s+(day|days|week|weeks|month|months)\\s+(?:from\\s+(?:now|today)|later)\\b`)))) {
    const n = toN(m[1]);
    const unit = m[2];
    if (/^month/.test(unit)) return out(addMonths(today, n));
    return out(addDays(today, /^week/.test(unit) ? n * 7 : n));
  }
  if ((m = t.match(/بعد\s+(\d{1,3})\s*(يوم|أيام|ايام|اسبوع|أسبوع|أسابيع|اسابيع|شهر|أشهر|اشهر)/))) {
    const n = Number(m[1]);
    if (/شهر|أشهر|اشهر/.test(m[2])) return out(addMonths(today, n));
    return out(addDays(today, /سبوع|سابيع/.test(m[2]) ? n * 7 : n));
  }
  if (/بعد\s+(أسبوع|اسبوع)/.test(t)) return out(addDays(today, 7));
  if (/بعد\s+(أسبوعين|اسبوعين)/.test(t)) return out(addDays(today, 14));
  if (/بعد\s+شهر/.test(t)) return out(addMonths(today, 1));
  if (/\bnext\s+week\b|(الأسبوع|الاسبوع)\s+(الجاي|القادم|الياي)/.test(t)) return out(addDays(today, 7));
  if (/\bnext\s+month\b|الشهر\s+(الجاي|القادم|الياي)/.test(t)) return out(addMonths(today, 1));
  if (/\b(this\s+)?weekend\b|(نهاية|آخر|اخر)\s+(الأسبوع|الاسبوع)/.test(t)) {
    return out(addDays(today, (5 - today.getUTCDay() + 7) % 7));
  }

  if (/\b(yesterday|day\s+before\s+yesterday)\b|(^|\s)(أمس|امس|البارحة|البارح)(?=[\s,.!?؟]|$)/.test(t)) {
    return out(addDays(today, /day\s+before/.test(t) ? -2 : -1));
  }
  if (/day after tomorrow|بعد (بكرة|بكره|بكرا|غد|الغد|غدا)/.test(t)) return out(addDays(today, 2));
  if (/(^|\s)(tomorrow|tmrw|tmr|tommorow|tomorow|tomoro|kal|بكرة|بكره|بكرا|غدا|غدًا|الغد|غداً)(?=[\s,.!?؟]|$)/.test(t)) {
    return out(addDays(today, 1));
  }
  if (/(^|\s)(today|tonight|aaj|اليوم|الليلة)(?=[\s,.!?؟]|$)/.test(t)) return out(today);

  for (let i = 0; i < WEEKDAY_WORDS.length; i += 1) {
    const alt = WEEKDAY_WORDS[i].join('|');
    const hit = t.match(new RegExp(`(^|\\s)(next\\s+|this\\s+|يوم\\s+|on\\s+)?(${alt})(\\s+(القادم|الجاي|الياي|الجاية))?(?=[\\s,.!?؟]|$)`));
    if (hit) {
      let diff = (i - today.getUTCDay() + 7) % 7;
      const next = (hit[2] && hit[2].trim() === 'next') || Boolean(hit[4]);
      if (next && diff === 0) diff = 7;
      return out(addDays(today, diff), { weekdayToday: diff === 0 && !(hit[2] && hit[2].trim() === 'this'), weekday: i });
    }
  }
  return { date: '', issue: '', weekdayToday: false, weekday: null };
};

/** Back-compatible: a usable day as YYYY-MM-DD, or ''. */
const extractDeliveryDay = (text = '', nowMs = Date.now()) => {
  const r = parseDeliveryDay(text, nowMs);
  return r.date && !r.issue ? r.date : '';
};

module.exports = {
  normalizeInbound,
  refKey,
  detectInboundLanguage,
  renderModeFor,
  extractReferences,
  extractOcrReference,
  classifyInbound,
  classifyOwnerIntent,
  classifyEmojiOnly,
  parseDims,
  parseDeliveryDay,
  extractDeliveryDay,
};
