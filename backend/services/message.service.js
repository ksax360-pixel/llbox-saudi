/**
 * LLBox WhatsApp conversation message builders.
 * Spec: LLBox_WhatsApp_Conversation_Reference-1.pdf + API Changes addendum 2.2
 */

const detectLanguage = (text = '') => {
  const s = String(text || '');
  if (!s.trim()) return 'en';
  const hasArabic = /[\u0600-\u06FF]/.test(s);
  const hasLatin = /[A-Za-z]{3,}/.test(s);
  if (hasArabic && hasLatin) return 'mixed';
  if (hasArabic) return 'ar';
  // Arabic written in Latin letters (common driver shorthand)
  if (/\b(wein|wein al|al box|marhaba|shukran|tawseel)\b/i.test(s)) return 'ar';
  return 'en';
};

/** Convert UTC ISO timestamp → Riyadh wall-clock phrase (UTC+3). */
const formatValidUntil = (otpExpiresAt, lang = 'en') => {
  if (!otpExpiresAt) return lang === 'ar' ? 'صالح لفترة محدودة' : 'valid for a limited time';
  const utc = new Date(otpExpiresAt);
  if (Number.isNaN(utc.getTime())) return String(otpExpiresAt);

  const riyadh = new Date(utc.getTime() + 3 * 60 * 60 * 1000);
  const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const hh = String(riyadh.getUTCHours()).padStart(2, '0');
  const mm = String(riyadh.getUTCMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;

  const sameDay =
    riyadh.getUTCFullYear() === now.getUTCFullYear() &&
    riyadh.getUTCMonth() === now.getUTCMonth() &&
    riyadh.getUTCDate() === now.getUTCDate();

  if (sameDay) {
    return lang === 'ar' ? `صالح حتى الساعة ${time} اليوم` : `Valid until ${time} today.`;
  }

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  if (lang === 'ar') return `صالح حتى يوم ${daysAr[riyadh.getUTCDay()]} الساعة ${time}`;
  return `Valid until ${days[riyadh.getUTCDay()]} ${time}.`;
};

const mapUrl = (data = {}) =>
  String(data.googleMaps || data.google_maps_link || data.googleMapsLink || '').trim();

const shortMapUrl = (url) => {
  if (!url) return '';
  return url.replace(/^https?:\/\//i, '');
};

const CATEGORY_CAPTION = {
  en: {
    street: 'Street',
    building: 'Building',
    entrance: 'Entrance',
    door: 'Entrance',
    box: 'The box',
    site: 'Site',
  },
  ar: {
    street: 'الشارع',
    building: 'المبنى',
    entrance: 'المدخل',
    door: 'المدخل',
    box: 'الصندوق',
    site: 'الموقع',
  },
};

/**
 * Normalize LLBox box_photos (+ legacy box_photo_url) into WhatsApp-ready image payloads.
 * Spec: send as images after handover, caption = photo.caption || category label.
 */
const normalizeBoxPhotos = (data = {}, { language = 'en', languages } = {}) => {
  const langs = (Array.isArray(languages) && languages.length
    ? languages
    : [language === 'ar' || language === 'mixed' ? 'ar' : 'en']
  ).filter((l) => CATEGORY_CAPTION[l]);
  const labels = {};
  for (const cat of Object.keys(CATEGORY_CAPTION.en)) {
    labels[cat] = langs.map((l) => CATEGORY_CAPTION[l][cat]).join(' · ');
  }
  const raw = Array.isArray(data.boxPhotos)
    ? data.boxPhotos
    : Array.isArray(data.box_photos)
      ? data.box_photos
      : [];

  const photos = [];
  const seen = new Set();
  const push = (url, category, caption) => {
    const link = String(url || '').trim();
    if (!/^https?:\/\//i.test(link) || seen.has(link)) return;
    seen.add(link);
    const cat = String(category || '').trim().toLowerCase() || 'box';
    const custom = String(caption || '').trim();
    const label = labels[cat] || labels.box;
    const arLabel = langs.includes('ar') ? (CATEGORY_CAPTION.ar[cat] || CATEGORY_CAPTION.ar.box) : '';
    let finalCaption = custom || label;
    if (custom && arLabel && !/[\u0600-\u06FF]/.test(custom)) finalCaption = `${arLabel} — ${custom}`;
    photos.push({
      url: link,
      category: cat,
      caption: finalCaption,
    });
  };

  for (const item of raw) {
    if (!item) continue;
    if (typeof item === 'string') {
      push(item, 'box', '');
      continue;
    }
    push(
      item.url || item.secure_url || item.image_url || item.href,
      item.category || item.type || item.kind,
      item.caption || item.label || ''
    );
  }

  // Legacy single image — array should never be pointlessly empty when URL exists
  const legacy = data.boxPhotoUrl || data.box_photo_url;
  if (!photos.length && legacy) push(legacy, 'box', '');

  return photos;
};

/**
 * Driver handover message (Scenario A) — one scrollable message with code + steps.
 */
const buildDriverHandoverMessage = (data = {}, { language = 'en', orderReference = '' } = {}) => {
  const lang = language === 'ar' || language === 'mixed' ? 'ar' : 'en';
  const otp = String(data.otp || '');
  const address = String(
    (lang === 'ar' && (data.addressArabic || data.address_arabic)) || data.address || ''
  ).trim();
  const maps = mapUrl(data);
  const ref = String(orderReference || data.orderReference || '').trim();
  const validUntil = formatValidUntil(data.otpExpiresAt || data.otp_expires_at, lang);
  const normalizedPhotos = normalizeBoxPhotos(data, { language: lang });
  const hasPhotos = normalizedPhotos.length > 0;

  if (lang === 'ar') {
    const lines = [
      '👋 مرحبًا، أنا LLBox',
      '',
      ref
        ? `وجدت الصندوق الذي ينتظر الطلب رقم ${ref}، وسأستلمه منك.`
        : 'وجدت الصندوق، وسأستلمه منك.',
      '',
      'رمز الاستلام الخاص بك',
      otp,
      validUntil,
      '',
    ];
    if (address) lines.push(`📍 ${address}`);
    if (maps) lines.push(`الخريطة: ${shortMapUrl(maps)}`);
    if (hasPhotos) {
      lines.push('', 'أرسلت لك صور الشارع والصندوق أدناه لتسهيل الوصول.');
    }
    lines.push(
      '',
      'الخطوات عند الوصول',
      '١. ابحث عن صندوق LLBox في العنوان أعلاه',
      `٢. أدخل الرمز ${otp} على لوحة المفاتيح`,
      '٣. سيفتح الغطاء',
      '٤. ضع الطرد بالداخل بعناية',
      '٥. أغلق الغطاء جيدًا حتى تسمع صوت الإغلاق',
      '٦. وبذلك يتم تسجيل التسليم تلقائيًا',
      '',
      'لا حاجة لأي توقيع. شكرًا لك، وقيادة آمنة.'
    );
    return lines.join('\n');
  }

  const lines = [
    'Hello, this is LLBox 👋',
    '',
    ref
      ? `I've found the box expecting order ${ref}, and I'll take the delivery for you.`
      : "I've found the box, and I'll take the delivery for you.",
    '',
    'Your one-time code',
    otp,
    validUntil,
    '',
  ];
  if (address) lines.push(`📍 ${address}`);
  if (maps) lines.push(`Map: ${shortMapUrl(maps)}`);
  if (hasPhotos) {
    lines.push('', "I've sent photos of the street and the box below so you can find it easily.");
  }
  lines.push(
    '',
    'What to do when you arrive',
    '1. Find the LLBox at the address above',
    `2. Enter ${otp} on the keypad`,
    '3. The lid will open',
    '4. Place the parcel inside carefully',
    '5. Close the lid firmly until it clicks',
    "6. That's it — the delivery is marked complete automatically",
    '',
    'No signature needed. Thanks, and drive safely.'
  );
  return lines.join('\n');
};

const DRIVER_REFUSAL_SAY = {
  en: {
    not_found:
      "That number isn't registered with us.\n\nCould you double-check it on the label? If it's right, the customer may not have registered this delivery yet — in that case please reach them through your delivery app.",
    expired: 'That delivery was registered with us, but the hold period has ended.',
    already_matched:
      'Another driver already has the code for that order.\nIf that\'s not you, please check the number on your label — it may belong to a different parcel.',
    already_completed:
      "That order is already recorded as delivered, so there's nothing to do here. If you're still holding a parcel for it, let me know and I'll contact the customer.",
    cancelled:
      'The customer cancelled that delivery. Please return the parcel through your usual process.',
    ambiguous:
      "That number matches more than one delivery here, so I don't want to send you to the wrong place.\n\nCould you read me the full number from the label, including any letters at the start?",
    at_capacity:
      'That box cannot take another delivery right now. Please follow your usual undelivered-parcel process, or try again later.',
    maintenance:
      'That box is temporarily offline. Please try again shortly, or follow your usual undelivered-parcel process.',
    deactivated:
      'That box is no longer in service. Please follow your usual undelivered-parcel process.',
  },
  ar: {
    not_found:
      'هذا الرقم غير مسجّل لدينا.\n\nهل يمكنك التأكد منه على الملصق؟ إذا كان صحيحًا، فربما لم يسجّل العميل هذا الطلب بعد — في هذه الحالة يرجى التواصل معه عبر تطبيق التوصيل لديك.',
    expired: 'هذا الطلب كان مسجّلًا لدينا، لكن مدة الحجز انتهت.',
    already_matched:
      'هناك سائق آخر لديه رمز هذا الطلب بالفعل.\nإذا لم تكن أنت، يرجى التحقق من الرقم على ملصقك — قد يخص طردًا آخر.',
    already_completed:
      'هذا الطلب مسجّل كَمُسلَّم بالفعل، فلا يوجد إجراء مطلوب. إذا كان الطرد لا يزال معك، أخبرني وسأتواصل مع العميل.',
    cancelled: 'قام العميل بإلغاء هذا الطلب. يرجى إعادة الطرد وفق الإجراء المعتاد لديك.',
    ambiguous:
      'هذا الرقم يطابق أكثر من طلب لدينا، ولا أريد أن أرسلك إلى العنوان الخطأ.\n\nهل يمكنك إرسال الرقم كاملًا كما هو على الملصق، بما في ذلك الأحرف في بدايته؟',
    at_capacity:
      'هذا الصندوق لا يمكنه استقبال طلب آخر الآن. يرجى اتباع إجراء الطرد غير المسلَّم المعتاد، أو المحاولة لاحقًا.',
    maintenance: 'هذا الصندوق غير متصل مؤقتًا. يرجى المحاولة بعد قليل، أو اتباع إجراء الطرد غير المسلَّم.',
    deactivated: 'هذا الصندوق لم يعد في الخدمة. يرجى اتباع إجراء الطرد غير المسلَّم المعتاد.',
  },
};

const buildDriverRefusalMessage = (reason, { language = 'en', apiMessage } = {}) => {
  const lang = language === 'ar' || language === 'mixed' ? 'ar' : 'en';
  const key = String(reason || '').toLowerCase();
  return (
    DRIVER_REFUSAL_SAY[lang][key] ||
    apiMessage ||
    (lang === 'ar'
      ? 'حدثت مشكلة في هذا الرقم. هل يمكنك إرساله مرة أخرى كما هو على الملصق؟'
      : 'There was a problem with that number. Could you send it again exactly as on the label?')
  );
};

module.exports = {
  detectLanguage,
  formatValidUntil,
  buildDriverHandoverMessage,
  buildDriverRefusalMessage,
  normalizeBoxPhotos,
  mapUrl,
};
