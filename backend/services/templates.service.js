/**
 * Fixed WhatsApp reply templates (EN + AR).
 * Wording: LLBox WhatsApp Conversation Reference v1.0 + Test Report 2026-09-30 §5.7.
 * Every safety, refusal, handover and stuck-driver reply comes from here — never from the LLM.
 */

const T = {
  opener: {
    en: "Hello 👋 You've reached LLBox.\nAre you here to drop off a delivery, or would you like to know more about LLBox?",
    ar: 'مرحبًا 👋 لقد وصلت إلى LLBox.\nهل أنت هنا لتسليم طلب؟ أم تود معرفة المزيد عن LLBox؟',
  },
  askReference: {
    en: "Could you send me the order or tracking number? It's usually printed on the parcel label.",
    ar: 'هل يمكنك إرسال رقم الطلب أو رقم التتبع؟ عادةً يكون مطبوعًا على ملصق الطرد.',
  },
  askReferenceDelivering: {
    en: "Great — I'll take it for you.\nCould you send me the order or tracking number? It's usually printed on the parcel label, or shown in your delivery app.",
    ar: 'ممتاز — سأستلمه منك.\nهل يمكنك إرسال رقم الطلب أو رقم التتبع؟ عادةً يكون مطبوعًا على ملصق الطرد، أو ظاهرًا في تطبيق التوصيل لديك.',
  },
  productInfo: {
    en: "LLBox is a smart box fitted at a customer's home. When a delivery arrives and nobody is in, the driver gets a one-time code, opens the box, leaves the parcel safely inside, and the customer is notified straight away.\n\nIf you'd like one, you can find out more at llbox.ai. Is there a delivery I can help with today?",
    ar: 'LLBox صندوق ذكي يُركَّب في منزل العميل. عند وصول طلب ولا يوجد أحد في المنزل، يحصل السائق على رمز يُستخدم مرة واحدة، يفتح الصندوق، ويضع الطرد بأمان في الداخل، ويُشعَر العميل فورًا.\n\nإذا رغبت في الحصول على واحد، يمكنك معرفة المزيد عبر llbox.ai. هل هناك طلب أستطيع مساعدتك فيه اليوم؟',
  },
  tooShort: {
    en: 'That looks too short. Could you send the full number from the label?',
    ar: 'يبدو هذا الرقم قصيرًا جدًا. هل يمكنك إرسال الرقم كاملًا كما هو على الملصق؟',
  },
  twoNumbers: {
    en: "I see two numbers. Let's do {first} now — then send me {second}.",
    ar: 'أرى رقمين. لنبدأ بـ {first} الآن — ثم أرسل لي {second}.',
  },
  completionClaim: {
    en: "Thanks — the delivery is recorded once the code is entered and the lid is closed. Let me know if the box won't open.",
    ar: 'شكرًا — يُسجَّل التسليم بمجرد إدخال الرمز وإغلاق الغطاء. أخبرني إذا لم يفتح الصندوق.',
  },
  contactRequest: {
    en: "I can't share the customer's number, but I can message them for you. What's the order number?",
    ar: 'لا أستطيع مشاركة رقم العميل، لكن يمكنني مراسلته نيابةً عنك. ما رقم الطلب؟',
  },
  offBox: {
    en: "Deliveries are completed only at the LLBox. I can ask the customer for you — what's the order number?",
    ar: 'يتم التسليم فقط في صندوق LLBox. يمكنني سؤال العميل نيابةً عنك — ما رقم الطلب؟',
  },
  thanks: {
    en: "You're welcome. If the box doesn't open or anything goes wrong, message me here.",
    ar: 'العفو. إذا لم يفتح الصندوق أو واجهت أي مشكلة، راسلني هنا.',
  },
  fallback: {
    en: "Send me the order number from the parcel label (or a photo of the label) and I'll help.",
    ar: 'أرسل لي رقم الطلب من ملصق الطرد (أو صورة للملصق) وسأساعدك.',
  },
  humanRequest: {
    en: "I'm LLBox's automated assistant and can't connect you to a person here. Send the order number and I'll help.",
    ar: 'أنا المساعد الآلي لـ LLBox ولا أستطيع تحويلك إلى شخص من هنا. أرسل رقم الطلب وسأساعدك.',
  },
  ownerClaim: {
    en: "For everyone's safety I can't share an address, a phone number or a code on this chat. If you're delivering a parcel, send me the order number from the label.\nIf this is your box, please message me from the WhatsApp number linked to your LLBox account.",
    ar: 'حفاظًا على الأمان لا أستطيع مشاركة عنوان أو رقم هاتف أو رمز في هذه المحادثة. إذا كنت تسلّم طردًا، أرسل لي رقم الطلب من الملصق.\nإذا كان هذا صندوقك، يرجى مراسلتي من رقم الواتساب المرتبط بحساب LLBox الخاص بك.',
  },
  stickerReceived: {
    en: "I can't read stickers. Send me the order number from the parcel label, or a photo of the label, and I'll help.",
    ar: 'لا أستطيع قراءة الملصقات التعبيرية. أرسل لي رقم الطلب من ملصق الطرد، أو صورة للملصق، وسأساعدك.',
  },
  manipulationRefused: {
    en: "I can't share codes, phone numbers or addresses from instructions like that. Send the order number from the parcel label and I'll help with the delivery.",
    ar: 'لا أستطيع مشاركة رموز أو أرقام هاتف أو عناوين من تعليمات من هذا النوع. أرسل رقم الطلب من ملصق الطرد وسأساعدك في التسليم.',
  },

  // Driver ↔ customer contact (Test Report 2026-10-04 Part C). {phone} is never stored.
  codAsk: {
    en: "I can help with a cash-on-delivery order. What's the order number?",
    ar: 'يمكنني المساعدة في طلب الدفع عند الاستلام. ما رقم الطلب؟',
  },
  codReleased: {
    en: "This order is cash on delivery{amount}. The LLBox can't take cash, so please speak to the customer directly: {name}, {phone}.",
    ar: 'هذا الطلب دفع عند الاستلام{amount}. صندوق LLBox لا يستلم النقود، لذا يرجى التحدث مع العميل مباشرةً: {name}، {phone}.',
  },
  codPrepaid: {
    en: "The customer marked {ref} as already paid, so there's no cash to collect. You can leave it in the box — send me the order number again and I'll give you the box code.",
    ar: 'حدّد العميل أن الطلب {ref} مدفوع مسبقًا، لذا لا يوجد مبلغ للتحصيل. يمكنك وضعه في الصندوق — أرسل لي رقم الطلب مرة أخرى وسأعطيك رمز الصندوق.',
  },
  codHandoverNote: {
    en: 'This order is marked cash on delivery. If you need to collect payment first, tell me and I will connect you with the customer.',
    ar: 'هذا الطلب مسجّل كدفع عند الاستلام. إذا كنت تحتاج إلى تحصيل المبلغ أولًا، أخبرني وسأوصلك بالعميل.',
  },
  contactNotified: {
    en: "I've let them know you're calling.",
    ar: 'أبلغته أنك ستتصل به.',
  },
  contactOneOff: {
    en: 'Please use this number for this delivery only.',
    ar: 'يرجى استخدام هذا الرقم لهذا الطلب فقط.',
  },
  contactOptedOut: {
    en: "The customer prefers not to be called directly. I've told them you need help and they should reply shortly.",
    ar: 'يفضّل العميل عدم الاتصال به مباشرةً. أبلغته أنك تحتاج إلى مساعدة ومن المتوقع أن يرد قريبًا.',
  },
  contactLimitedNotified: {
    en: "I can't share the customer's number for {ref} right now, but I've let them know in their app that you need them. They should reply shortly.",
    ar: 'لا أستطيع مشاركة رقم عميل الطلب {ref} الآن، لكني أبلغته عبر التطبيق أنك تحتاجه. من المتوقع أن يرد قريبًا.',
  },
  noValidRef: {
    en: "I can't share customer details for that number. Please check the order number on the label and send it in full — then I can help or pass a message.",
    ar: 'لا أستطيع مشاركة بيانات العميل لهذا الرقم. يرجى التحقق من رقم الطلب على الملصق وإرساله كاملًا — بعدها يمكنني المساعدة أو إيصال رسالة.',
  },
  deadBoxOnline: {
    en: 'The box is responding on our side. Please try the code once more, all six digits, and wait for the beep.\nIf it still won\'t open, tell me and I\'ll let the customer know.',
    ar: 'الصندوق يستجيب من جهتنا. يرجى إدخال الرمز مرة أخرى، الأرقام الستة كاملة، وانتظار صوت التنبيه.\nإذا لم يفتح، أخبرني وسأبلغ العميل.',
  },
  deadBoxPending: {
    en: "Please try the code once more. I'm checking the box and I'll message you here.",
    ar: 'يرجى تجربة الرمز مرة أخرى. أتحقق من الصندوق وسأراسلك هنا.',
  },
  deadBoxReleased: {
    en: "Sorry, the box isn't responding on our side either. Please call the customer to arrange the handover: {name}, {phone}.",
    ar: 'عذرًا، الصندوق لا يستجيب من جهتنا أيضًا. يرجى الاتصال بالعميل لترتيب التسليم: {name}، {phone}.',
  },
  deadBoxDenied: {
    en: "I couldn't confirm a fault with the box for {ref}. Please try the code once more; if it still won't open, tell me and I'll let the customer know.",
    ar: 'لم أتمكن من تأكيد وجود عطل في صندوق الطلب {ref}. يرجى تجربة الرمز مرة أخرى؛ وإذا لم يفتح، أخبرني وسأبلغ العميل.',
  },
  deadBoxTimeout: {
    en: "I'm still waiting on the box check for {ref}, so I've let the customer know in their app. If you can't wait, please follow your usual process for an undelivered parcel.",
    ar: 'ما زلت أنتظر نتيجة فحص صندوق الطلب {ref}، لذا أبلغت العميل عبر التطبيق. إذا لم تستطع الانتظار، يرجى اتباع الإجراء المعتاد للطرد غير المسلَّم.',
  },
  parcelAskSize: {
    en: "Please don't force the lid. What are the parcel's length, width and height in centimetres? For example: 60 x 40 x 30",
    ar: 'الرجاء عدم الضغط على الغطاء. ما طول الطرد وعرضه وارتفاعه بالسنتيمتر؟ مثلًا: 60 x 40 x 30',
  },
  parcelReleased: {
    en: "Please don't force the lid. Call the customer to arrange the handover: {name}, {phone}.",
    ar: 'الرجاء عدم الضغط على الغطاء. اتصل بالعميل لترتيب التسليم: {name}، {phone}.',
  },
  parcelFits: {
    en: "By the box's size this should fit. Try turning it onto its smallest side first.\nIf it still won't go in, tell me and I'll let the customer know.",
    ar: 'بحسب مقاس الصندوق يُفترض أن يتسع الطرد. جرّب إدخاله على أصغر جوانبه أولًا.\nإذا لم يدخل، أخبرني وسأبلغ العميل.',
  },
  driverThanks: {
    en: 'Thanks — {ref} is recorded as delivered ✅',
    ar: 'شكرًا — تم تسجيل تسليم الطلب {ref} ✅',
  },
  completionConfirmed: {
    en: 'Thanks — {ref} is recorded as delivered ✅',
    ar: 'شكرًا — تم تسجيل تسليم الطلب {ref} ✅',
  },
  askPhoto: {
    en: "No problem — could you take a photo of the parcel label and send it here? I'll read the number from it.",
    ar: 'لا مشكلة — هل يمكنك تصوير ملصق الطرد وإرساله هنا؟ سأقرأ الرقم منه.',
  },
  photoUnreadable: {
    en: "I can't quite make out the number on that one. Could you take another photo, a bit closer and with the label flat?",
    ar: 'لم أتمكن من قراءة الرقم بوضوح. هل يمكنك التقاط صورة أخرى من مسافة أقرب مع تسوية الملصق؟',
  },
  lookupError: {
    en: "I couldn't check that number just now. Please send it again in a minute.",
    ar: 'لم أتمكن من التحقق من هذا الرقم الآن. يرجى إرساله مرة أخرى بعد دقيقة.',
  },
  secondFailure: {
    en: "I still can't match that number. Rather than keep you trying: if you have the parcel label, send me a photo of it and I'll read it — otherwise please reach the customer through your delivery app.",
    ar: 'ما زلت لا أستطيع مطابقة هذا الرقم. بدلًا من تكرار المحاولة: إذا كان ملصق الطرد معك، أرسل لي صورته وسأقرأ الرقم منه — وإلا يرجى التواصل مع العميل عبر تطبيق التوصيل لديك.',
  },
  codeAlreadySent: {
    en: "I've already sent the code for {ref} in this chat. For security a code is shown only once and can't be sent again — please scroll up to find it.\nIf it isn't working, tell me and I'll let the customer know.",
    ar: 'سبق أن أرسلت رمز الطلب {ref} في هذه المحادثة. حفاظًا على الأمان يظهر الرمز مرة واحدة فقط ولا يمكن إرساله مجددًا — يرجى الرجوع للأعلى للعثور عليه.\nإذا لم يعمل، أخبرني وسأبلغ العميل.',
  },
  addressAgain: {
    en: "Here's the address for {ref} again (the code was sent earlier in this chat):",
    ar: 'هذا عنوان الطلب {ref} مرة أخرى (أُرسل الرمز سابقًا في هذه المحادثة):',
  },

  // Stuck driver — asked before we have a reference
  stuckAsk_code_not_working: {
    en: "Sorry the code isn't working. What's the order number? I'll let the customer know right away.",
    ar: 'آسف أن الرمز لا يعمل. ما رقم الطلب؟ سأبلغ العميل فورًا.',
  },
  stuckAsk_parcel_too_large: {
    en: "If it doesn't fit, please don't force the lid. Leave the parcel out of the box and close the lid.\nWhat's the order number? I'll tell the customer right away so they can come down.",
    ar: 'إذا كان الطرد لا يتسع، الرجاء عدم الضغط على الغطاء. اترك الطرد خارج الصندوق وأغلق الغطاء.\nما رقم الطلب؟ سأبلغ العميل فورًا للنزول واستلامه.',
  },
  stuckAsk_box_full: {
    en: "If the box is full, please don't force the lid. Leave the parcel out of the box and close the lid.\nWhat's the order number? I'll tell the customer right away so they can come down.",
    ar: 'إذا كان الصندوق ممتلئًا، الرجاء عدم الضغط على الغطاء. اترك الطرد خارج الصندوق وأغلق الغطاء.\nما رقم الطلب؟ سأبلغ العميل فورًا للنزول واستلامه.',
  },
  stuckAsk_cannot_find_box: {
    en: "What's the order number? I'll send you the box location and let the customer know you're there.",
    ar: 'ما رقم الطلب؟ سأرسل لك موقع الصندوق وأبلغ العميل أنك وصلت.',
  },

  // Stuck driver — line before the notify outcome
  stuckLead_code_not_working: {
    en: "Sorry the code isn't working for {ref}.",
    ar: 'آسف أن الرمز لا يعمل للطلب {ref}.',
  },
  stuckLead_parcel_too_large: {
    en: "Please don't force the lid — leave the parcel out of the box for {ref} and close the lid.",
    ar: 'الرجاء عدم الضغط على الغطاء — اترك طرد الطلب {ref} خارج الصندوق وأغلق الغطاء.',
  },
  stuckLead_box_full: {
    en: "Please don't force the lid — leave the parcel out of the box for {ref} and close the lid.",
    ar: 'الرجاء عدم الضغط على الغطاء — اترك طرد الطلب {ref} خارج الصندوق وأغلق الغطاء.',
  },
  stuckLead_cannot_find_box: {
    en: 'About {ref}:',
    ar: 'بخصوص الطلب {ref}:',
  },
  stuckLead_contact: {
    en: "I can't share the customer's number for {ref}.",
    ar: 'لا أستطيع مشاركة رقم عميل الطلب {ref}.',
  },
  stuckLead_offbox: {
    en: "Deliveries are completed only at the LLBox, so please don't leave {ref} with anyone else.",
    ar: 'يتم التسليم فقط في صندوق LLBox، لذا يرجى عدم ترك الطلب {ref} مع أي شخص آخر.',
  },
  customerDriverStuck: {
    en: "Sorry about that. You can open your box for the driver from the LLBox app right now — that's the quickest fix.",
    ar: 'أعتذر عن ذلك. يمكنك فتح صندوقك للسائق من تطبيق LLBox الآن — هذا أسرع حل.',
  },
  stuckLead_other: {
    en: 'About {ref}:',
    ar: 'بخصوص الطلب {ref}:',
  },

  notified: {
    en: "I've let the customer know in their app and they should reply shortly.\nIf you can't wait, please follow your usual process for an undelivered parcel — nothing is recorded against you.",
    ar: 'أبلغت العميل عبر التطبيق ومن المتوقع أن يرد قريبًا.\nإذا لم تستطع الانتظار، يرجى اتباع الإجراء المعتاد للطرد غير المسلَّم — لن يُسجَّل شيء عليك.',
  },
  notNotified: {
    en: "I don't have a customer registered against that number, so there's nobody I can notify from here. Please contact them through your delivery app.",
    ar: 'لا يوجد عميل مسجّل لدي بهذا الرقم، لذا لا أستطيع إبلاغ أحد من هنا. يرجى التواصل معه عبر تطبيق التوصيل لديك.',
  },
  notifyError: {
    en: "I couldn't reach the customer just now. Please try again in a minute, or follow your usual process for an undelivered parcel.",
    ar: 'لم أتمكن من الوصول إلى العميل الآن. يرجى المحاولة بعد دقيقة، أو اتباع الإجراء المعتاد للطرد غير المسلَّم.',
  },
  expiredNotified: {
    en: "I've let the customer know in their app so they can register it again. Give them a moment, then send me the number once more.",
    ar: 'أبلغت العميل عبر التطبيق ليعيد تسجيله. امنحه لحظة ثم أرسل لي الرقم مرة أخرى.',
  },
  expiredNotNotified: {
    en: "There's nobody I can notify about it from here, so please contact the customer through your delivery app.",
    ar: 'لا أستطيع إبلاغ أحد بشأنه من هنا، لذا يرجى التواصل مع العميل عبر تطبيق التوصيل لديك.',
  },

  // Recipient (known LLBox account)
  customerGreeting: {
    en: 'Hello{name} 👋 This is LLBox.{summary}\n\nWould you like to register a delivery you\'re expecting? Send me the order or tracking number.',
    ar: 'مرحبًا{name} 👋 معك LLBox.\n\nهل تود تسجيل طلب تنتظره؟ أرسل لي رقم الطلب أو رقم التتبع.',
  },
  customerThanks: {
    en: "You're welcome. Send me the order number of any delivery you're expecting and I'll register it.",
    ar: 'العفو. أرسل لي رقم أي طلب تنتظره وسأسجّله لك.',
  },
  ownerRegisteredLine: {
    en: 'Done ✅ {ref} is registered{day}.',
    ar: '✅ تم تسجيل الطلب {ref}{day}.',
  },
  ownerRegisteredTrailer: {
    en: "When a driver arrives I'll give them a code and let you know.",
    ar: 'عند وصول السائق سأعطيه الرمز وأبلغك بذلك.',
  },
  customerRegistered: {
    en: "Done ✅ {ref} is registered{day}.\nWhen the driver arrives I'll give them a code and let you know.",
    ar: '✅ تم تسجيل الطلب {ref}{day}.\nعند وصول السائق سأعطيه الرمز وأبلغك بذلك.',
  },
  customerBoxTight: {
    en: 'That makes {count} deliveries expected on {dayName}.{holds} It may get tight if the parcels are large.',
    ar: 'بذلك يصبح لديك {count} طلبات متوقعة يوم {dayName}.{holds} وقد يضيق الصندوق إذا كانت الطرود كبيرة.',
  },
  boxHolds: {
    en: ' Your box comfortably holds {n}.',
    ar: ' صندوقك يتسع لـ {n} بشكل مريح.',
  },
  customerDayFull: {
    en: '{dayName} already has {limit} deliveries expected, which is the most your box can take in one day.\nWould another day work for {ref}? Or if a parcel is already sitting in the box, collecting it frees up space.',
    ar: 'يوم {dayName} لديه {limit} طلبات متوقعة، وهو الحد الأقصى لصندوقك في اليوم الواحد.\nهل يناسبك يوم آخر للطلب {ref}؟ أو إذا كان هناك طرد في الصندوق، فاستلامه سيوفر مساحة.',
  },
  customerDayInvalid: {
    en: "I couldn't use that day for {ref}. When are you expecting it? Today, tomorrow, or a date within the next 120 days.",
    ar: 'لم أتمكن من استخدام هذا اليوم للطلب {ref}. متى تتوقع وصوله؟ اليوم، غدًا، أو تاريخ خلال الـ 120 يومًا القادمة.',
  },
  ownerDayPast: {
    en: '{dayName} has already passed. When are you expecting {ref}? Today, tomorrow, or a date — or just say you\'re not sure.',
    ar: 'يوم {dayName} قد مضى. متى تتوقع وصول {ref}؟ اليوم، غدًا، أو تاريخ محدد — أو أخبرني أنك غير متأكد.',
  },
  ownerDayTooFar: {
    en: "{dayName} is more than 120 days away, and I can only register deliveries up to 120 days ahead. When are you expecting {ref}? Or just say you're not sure.",
    ar: 'يوم {dayName} بعد أكثر من 120 يومًا، ولا أستطيع تسجيل الطلبات لأبعد من 120 يومًا. متى تتوقع وصول {ref}؟ أو أخبرني أنك غير متأكد.',
  },
  registeredTodayNote: {
    en: 'That\'s today. If you meant next {weekday}, send "next {weekday}".',
    ar: 'هذا اليوم. إذا كنت تقصد {weekday} القادم، أرسل "{weekday} القادم".',
  },
  customerRefTaken: {
    en: '{ref} is already registered on another LLBox account, so I can\'t add it here. Please check the number on your order.',
    ar: 'الرقم {ref} مسجّل بالفعل على حساب LLBox آخر، لذا لا أستطيع إضافته هنا. يرجى التحقق من الرقم في طلبك.',
  },
  registerFailed: {
    en: "I couldn't register that delivery just now. Please send the number again in a minute.",
    ar: 'لم أتمكن من تسجيل هذا الطلب الآن. يرجى إرسال الرقم مرة أخرى بعد دقيقة.',
  },
  customerPhotoRead: {
    en: 'I read from your photo: {summary}.',
    ar: 'قرأت من صورتك: {summary}.',
  },
  customerPhotoNoRef: {
    en: 'I looked at your photo but could not find a clear order or tracking number. Please send a closer photo of the parcel label, or type the number.',
    ar: 'اطلعت على صورتك لكن لم أجد رقم طلب أو تتبع واضحًا. يرجى إرسال صورة أقرب لملصق الطرد، أو كتابة الرقم.',
  },

  // Box owner / member (Conversation Reference pp. 14–17, Test Report 2026-10-04 Part B)
  ownerHello: {
    en: 'Hello{name} 👋 This is LLBox.',
    ar: 'مرحبًا{name} 👋 معك LLBox.',
  },
  ownerNothingOnWay: {
    en: "Nothing is on its way at the moment. Would you like to register a delivery you're expecting?",
    ar: 'لا توجد طلبات قادمة حاليًا. هل تود تسجيل طلب تنتظره؟',
  },
  ownerNoBox: {
    en: "Your account doesn't have a box linked to it yet. Once a box is added in the LLBox app, I can register deliveries, send codes and check it for you here.",
    ar: 'لا يوجد صندوق مرتبط بحسابك بعد. بمجرد إضافة صندوق من تطبيق LLBox، يمكنني تسجيل الطلبات وإرسال الرموز ومتابعة الصندوق لك هنا.',
  },
  ownerMenuIntro: { en: 'I can help you:', ar: 'يمكنني مساعدتك في:' },
  ownerMenuAsk: {
    en: 'What would you like to do? Reply with a number or just tell me.',
    ar: 'كيف أساعدك؟ أرسل رقم الخيار أو اكتب طلبك.',
  },
  ownerNotUnderstood: {
    en: "Sorry, I didn't quite get that.",
    ar: 'عذرًا، لم أفهم طلبك تمامًا.',
  },
  menu_register: { en: 'Register a new delivery', ar: 'تسجيل طلب جديد' },
  menu_list: { en: "Check what's on the way", ar: 'معرفة الطلبات القادمة' },
  menu_cancel: { en: 'Cancel one you no longer expect', ar: 'إلغاء طلب لم تعد تنتظره' },
  menu_code: { en: 'Send you a code to open your box', ar: 'إرسال رمز لفتح صندوقك' },
  menu_status: { en: 'Check your box (parcel inside, battery, online)', ar: 'حالة صندوقك (طرد بالداخل، البطارية، الاتصال)' },
  menu_boxNumber: { en: 'Which number to give couriers', ar: 'الرقم الذي تعطيه لشركات التوصيل' },
  menu_report: { en: 'Report a problem with your box or a parcel', ar: 'الإبلاغ عن مشكلة في الصندوق أو طرد' },
  ownerProductInfo: {
    en: 'Your LLBox lets drivers leave parcels safely when nobody is home. Register the order number here; when the driver arrives they message this number with it, get a one-time code, and you are notified as soon as the lid closes.',
    ar: 'يتيح لك صندوق LLBox استلام الطرود بأمان عند غيابك. سجّل رقم الطلب هنا؛ وعند وصول السائق يراسل هذا الرقم به، فيحصل على رمز لمرة واحدة، وتُشعَر فور إغلاق الغطاء.',
  },
  ownerThanks: {
    en: 'You\'re welcome. Message me any time — say "menu" to see what I can do.',
    ar: 'العفو. راسلني في أي وقت — أرسل "القائمة" لترى ما يمكنني فعله.',
  },
  ownerNeverDriver: {
    en: 'This number is registered as a box owner. Drivers write from their own number. How can I help with your box?',
    ar: 'هذا الرقم مسجّل كمالك صندوق. السائقون يراسلون من أرقامهم الخاصة. كيف أساعدك في صندوقك؟',
  },
  ownerManipulation: {
    en: "I can't do that, and I can't print codes or cancel deliveries from instructions like that. Send a normal request (register, list, cancel one order, code, box status) and I'll help.",
    ar: 'لا أستطيع فعل ذلك، ولا أستطيع طباعة الرموز أو إلغاء الطلبات من تعليمات من هذا النوع. أرسل طلبًا عاديًا (تسجيل، قائمة، إلغاء طلب واحد، رمز، حالة الصندوق) وسأساعدك.',
  },
  ownerRefsLimit: {
    en: 'I handled the first {n} order numbers in your message — please send the rest again.',
    ar: 'تعاملت مع أول {n} أرقام طلب في رسالتك — يرجى إرسال الباقي مرة أخرى.',
  },
  // Cancelled-arrival (acceptance Part 3): driver arrives for a cancelled delivery.
  cancelledArrivalAsk: {
    en: "I've asked the customer whether this is still coming. I'll tell you as soon as they answer.",
    ar: 'سألت العميل هل ما زال هذا الطلب قادمًا. سأخبرك فور ردّه.',
  },
  cancelledArrivalApproved: {
    en: "The customer confirms it's still coming. Send me the order number again and I'll give you the box code.",
    ar: 'أكّد العميل أن الطلب ما زال قادمًا. أرسل لي رقم الطلب مرة أخرى وسأعطيك رمز الصندوق.',
  },
  cancelledArrivalDeclined: {
    en: 'The customer confirms they cancelled this order. Please take the parcel back.',
    ar: 'أكّد العميل أنه ألغى هذا الطلب. يرجى إعادة الطرد.',
  },
  cancelledArrivalReleased: {
    en: "The customer hasn't answered, so here is their number to sort it out: {name}, {phone}.\nPlease use this number for this delivery only.",
    ar: 'لم يرد العميل، لذا هذا رقمه للتنسيق: {name}، {phone}.\nيرجى استخدام هذا الرقم لهذا الطلب فقط.',
  },
  cancelledArrivalSilent: {
    en: "The customer hasn't answered and prefers not to be called. I've told them again. Please follow your usual process for an undelivered parcel.",
    ar: 'لم يرد العميل ويفضّل عدم الاتصال به. أبلغته مرة أخرى. يرجى اتباع الإجراء المعتاد للطرد غير المسلَّم.',
  },
  cancelledArrivalOwnerAsk: {
    en: "You cancelled order {ref}, but a driver says it has arrived at your LLBox. Is it still coming? Reply YES or NO. If I don't hear from you in 5 minutes I'll give the driver your number.",
    ar: 'ألغيت الطلب {ref}، لكن سائقًا يقول إنه وصل إلى صندوق LLBox. هل ما زال قادمًا؟ أرسل نعم أو لا. إذا لم أسمع منك خلال 5 دقائق سأعطي السائق رقمك.',
  },
  cancelledArrivalOwnerYes: {
    en: "Got it — I've told the driver {ref} is still coming. They'll get a code when they send the order number again.",
    ar: 'تم — أخبرت السائق أن الطلب {ref} ما زال قادمًا. سيحصل على الرمز عندما يرسل رقم الطلب مرة أخرى.',
  },
  cancelledArrivalOwnerNo: {
    en: "Got it — I've told the driver that {ref} stays cancelled and they should take the parcel back.",
    ar: 'تم — أخبرت السائق أن الطلب {ref} يبقى ملغى ويجب إعادة الطرد.',
  },
  ownerAskRef: {
    en: "Sure — what's the order or tracking number?",
    ar: 'بالتأكيد — ما رقم الطلب أو التتبع؟',
  },
  ownerNotARef: {
    en: "That doesn't look like an order number. What's the order or tracking number? It's on the order confirmation or the tracking page.",
    ar: 'لا يبدو هذا رقم طلب. ما رقم الطلب أو التتبع؟ تجده في تأكيد الطلب أو صفحة التتبع.',
  },
  ownerAskDay: {
    en: "Thanks. Roughly when are you expecting {ref}? Today, tomorrow, or a date — or just say you're not sure.",
    ar: 'شكرًا. متى تتوقع وصول {ref} تقريبًا؟ اليوم، غدًا، أو تاريخ محدد — أو أخبرني أنك غير متأكد.',
  },
  ownerAskDayAgain: {
    en: 'Which day are you expecting {ref}? For example "tomorrow", "Thursday" or "12 October" — or say "not sure".',
    ar: 'في أي يوم تتوقع وصول {ref}؟ مثلًا "بكرة" أو "الخميس" أو "12 أكتوبر" — أو قل "غير متأكد".',
  },
  ownerWhichBox: {
    en: 'Which box is this for?\n{options}\nReply with the number or the name.',
    ar: 'لأي صندوق؟\n{options}\nأرسل رقم الخيار أو الاسم.',
  },
  ownerCodAsk: {
    en: 'Is it cash on delivery? Reply "COD" (with the amount if you know it), "prepaid", or "not sure".',
    ar: 'هل الدفع عند الاستلام؟ أرسل "COD" (مع المبلغ إن كنت تعرفه)، أو "مدفوع"، أو "غير متأكد".',
  },
  ownerCodAskMany: {
    en: 'If any of these is cash on delivery, send its order number with "COD" and the amount.',
    ar: 'إذا كان أي منها دفعًا عند الاستلام، أرسل رقم الطلب مع "COD" والمبلغ.',
  },
  ownerCodSaved: {
    en: 'Noted — {ref} is marked cash on delivery{amount}.',
    ar: 'تم — الطلب {ref} مسجّل كدفع عند الاستلام{amount}.',
  },
  ownerPrepaidSaved: {
    en: 'Noted — {ref} is marked as already paid.',
    ar: 'تم — الطلب {ref} مسجّل كمدفوع مسبقًا.',
  },
  ownerCodSkipped: {
    en: "No problem — I've left the payment as unknown.",
    ar: 'لا مشكلة — تركت طريقة الدفع غير محددة.',
  },
  ownerListIntro: {
    en: "Here's what's coming to your box:",
    ar: 'هذه الطلبات القادمة إلى صندوقك:',
  },
  ownerListIntroMany: {
    en: "Here's what's coming to your boxes:",
    ar: 'هذه الطلبات القادمة إلى صناديقك:',
  },
  ownerListExpected: { en: '{ref} — expected {dayName}', ar: '{ref} — متوقع يوم {dayName}' },
  ownerListRegistered: { en: '{ref} — registered, waiting for the driver', ar: '{ref} — مسجّل، بانتظار السائق' },
  ownerListOnWay: { en: '{ref} — driver on the way now', ar: '{ref} — السائق في الطريق الآن' },
  ownerListDone: { en: '{ref} — delivered', ar: '{ref} — تم التسليم' },
  ownerListCancelled: { en: '{ref} — cancelled', ar: '{ref} — ملغى' },
  ownerListExpired: { en: '{ref} — expired', ar: '{ref} — منتهي' },
  ownerListMore: {
    en: '…and {n} more. Send me an order number to check a particular one.',
    ar: '…و{n} طلبات أخرى. أرسل لي رقم الطلب للاستعلام عن طلب محدد.',
  },
  ownerListCancelAsk: { en: 'Would you like to cancel any of them?', ar: 'هل تود إلغاء أي منها؟' },
  ownerListNoneInRange: {
    en: 'Nothing is expected at your box {range}.',
    ar: 'لا توجد طلبات متوقعة في صندوقك {range}.',
  },
  ownerRefNotOnBox: {
    en: "I can't see {ref} among the deliveries on your box. Would you like me to register it?",
    ar: 'لا أرى الطلب {ref} ضمن طلبات صندوقك. هل تود أن أسجّله؟',
  },
  ownerRefStatus_overdue: {
    en: '{ref} was expected{day} and is still waiting for the driver. If it is no longer coming, shall I cancel it? (yes / no)',
    ar: 'الطلب {ref} كان متوقعاً{day} وما زال بانتظار السائق. إذا لم يعد قادماً، هل ألغيه؟ (نعم / لا)',
  },
  ownerRefStatus_overdueNote: {
    en: '{ref} was expected{day} and is still waiting for the driver.',
    ar: 'الطلب {ref} كان متوقعاً{day} وما زال بانتظار السائق.',
  },
  ownerRefStatus_pending: {
    en: '{ref} is registered{day} and waiting for the driver.',
    ar: 'الطلب {ref} مسجّل{day} وبانتظار السائق.',
  },
  ownerRefStatus_matched: {
    en: '{ref}: a driver already has the code and is on the way.',
    ar: 'الطلب {ref}: السائق لديه الرمز وهو في الطريق.',
  },
  ownerRefStatus_completed: {
    en: '{ref} has been delivered to your box ✅',
    ar: 'تم تسليم الطلب {ref} في صندوقك ✅',
  },
  ownerRefStatus_cancelled: { en: '{ref} was cancelled.', ar: 'الطلب {ref} ملغى.' },
  ownerRefStatus_expired: {
    en: '{ref} expired — the hold window passed. Send it to me again and I\'ll register it.',
    ar: 'انتهت صلاحية الطلب {ref} — مضت فترة الحجز. أرسله لي مرة أخرى وسأسجّله.',
  },
  ownerCancelConfirm: {
    en: 'Cancel {ref}{day}? Reply "yes" to confirm.',
    ar: 'إلغاء الطلب {ref}{day}؟ أرسل "نعم" للتأكيد.',
  },
  ownerCancelPick: {
    en: 'Which one should I cancel?\n{options}\nReply with the number or the order reference.',
    ar: 'أي طلب تود إلغاءه؟\n{options}\nأرسل رقم الخيار أو رقم الطلب.',
  },
  ownerCancelled: {
    en: "Cancelled ✅ {ref} won't be accepted at your box.",
    ar: '✅ أُلغي الطلب {ref} ولن يُقبل في صندوقك.',
  },
  ownerAlreadyCancelled: {
    en: '{ref} was already cancelled — nothing more to do.',
    ar: 'الطلب {ref} ملغى بالفعل — لا حاجة لأي إجراء.',
  },
  ownerCancelTooLate: {
    en: "Too late for {ref}: a driver already has the code and is on the way, so I can't cancel it now. If it arrives and you don't want it, you can refuse it at the door.",
    ar: 'متأخر للطلب {ref}: السائق لديه الرمز بالفعل وهو في الطريق، لذا لا يمكنني الإلغاء الآن. إذا وصل ولم ترغب به، يمكنك رفضه عند الباب.',
  },
  ownerCancelFinished: {
    en: "{ref} is already finished, so there's nothing to cancel.",
    ar: 'الطلب {ref} منتهٍ بالفعل، لذا لا يوجد ما يُلغى.',
  },
  ownerCancelNotFound: {
    en: "I can't find {ref} among the deliveries on your box, so nothing was cancelled. Please check the number.",
    ar: 'لا أجد الطلب {ref} ضمن طلبات صندوقك، لذا لم يُلغَ شيء. يرجى التحقق من الرقم.',
  },
  ownerNothingToCancel: {
    en: "There's nothing I can cancel right now — only deliveries still waiting for a driver can be cancelled.",
    ar: 'لا يوجد ما يمكنني إلغاؤه الآن — يمكن إلغاء الطلبات التي ما زالت بانتظار السائق فقط.',
  },
  ownerCancelKept: {
    en: "OK, nothing cancelled. I've kept {ref}.",
    ar: 'حسنًا، لم أُلغِ شيئًا. أبقيت {ref}.',
  },
  ownerGuestCode: {
    en: "Here's a code to open your box{box}:\n{code}\n{validity} It opens the box for whoever you share it with, and doesn't affect any delivery.",
    ar: 'هذا رمز لفتح صندوقك{box}:\n{code}\n{validity} يفتح الصندوق لمن تشاركه معه، ولا يؤثر على أي طلب.',
  },
  codeValidHour: { en: 'Valid for the next hour.', ar: 'صالح لمدة ساعة.' },
  codeValidUntil: { en: 'Valid until {when}.', ar: 'صالح حتى {when}.' },
  ownerReplaceAsk: {
    en: "Sorry about that — I'll sort it out now. Which delivery is the driver there for?\n{options}\nReply with the number or the order reference. (If you just need to open the box yourself, say \"guest code\".)",
    ar: 'أعتذر عن ذلك — سأحل الأمر الآن. لأي طلب حضر السائق؟\n{options}\nأرسل رقم الخيار أو رقم الطلب. (إذا كنت تريد فتح الصندوق بنفسك فقط، قل "رمز ضيف".)',
  },
  ownerReplacedCode: {
    en: "Here's a new code for {ref}:\n{code}\nPlease give this to the driver. The old code no longer works. Once they enter this one and close the lid, the delivery is complete.",
    ar: 'هذا رمز جديد للطلب {ref}:\n{code}\nأعطه للسائق. الرمز القديم لم يعد يعمل. وبمجرد إدخاله وإغلاق الغطاء، يكتمل التسليم.',
  },
  ownerNoDeliveryForCode: {
    en: "I can't see a delivery on its way to your box, so there's no driver code to replace. If someone needs to open the box, I can send a guest code — just say \"guest code\".",
    ar: 'لا أرى طلبًا في الطريق إلى صندوقك، لذا لا يوجد رمز سائق لاستبداله. إذا كان أحد يحتاج لفتح الصندوق، يمكنني إرسال رمز ضيف — فقط قل "رمز ضيف".',
  },
  ownerCodeRefused: {
    en: "I couldn't create a code for {ref}: it's {status}. If someone needs to open the box, say \"guest code\".",
    ar: 'لم أتمكن من إنشاء رمز للطلب {ref}: حالته {status}. إذا كان أحد يحتاج لفتح الصندوق، قل "رمز ضيف".',
  },
  ownerBoxParcelInside: {
    en: "Yes — there's a parcel waiting in your box{box} now.",
    ar: 'نعم — هناك طرد في انتظارك في صندوقك{box} الآن.',
  },
  ownerBoxEmptyOnWay: {
    en: 'Not yet{box}. {refs} has a driver on the way — you\'ll be notified in the LLBox app once it\'s delivered.',
    ar: 'ليس بعد{box}. الطلب {refs} مع السائق في الطريق — ستصلك إشعار في تطبيق LLBox فور تسليمه.',
  },
  ownerBoxEmpty: {
    en: "Not yet — there's no parcel in your box{box} right now.",
    ar: 'ليس بعد — لا يوجد طرد في صندوقك{box} الآن.',
  },
  ownerBoxToday: {
    en: '{n} deliveries expected today (it comfortably holds {comfortable} a day, {most} at most).',
    ar: '{n} طلبات متوقعة اليوم (يتسع لـ {comfortable} يوميًا بشكل مريح، و{most} كحد أقصى).',
  },
  ownerBoxOnline: {
    en: 'The box is online{battery}.',
    ar: 'الصندوق متصل{battery}.',
  },
  ownerBoxOffline: {
    en: "The box hasn't checked in since {when}{battery}, so it may be offline. If it isn't working, tell me and I'll report it.",
    ar: 'لم يتصل الصندوق منذ {when}{battery}، لذا قد يكون غير متصل. إذا لم يكن يعمل، أخبرني وسأبلغ عن ذلك.',
  },
  ownerBoxOutOfService: {
    en: "The box is marked out of service at the moment. If you didn't expect that, tell me and I'll report it.",
    ar: 'الصندوق خارج الخدمة حاليًا. إذا لم تكن تتوقع ذلك، أخبرني وسأبلغ عن ذلك.',
  },
  ownerBoxUnknown: {
    en: "The box hasn't reported its status yet.",
    ar: 'لم يرسل الصندوق حالته بعد.',
  },
  ownerBoxFull: { en: 'It is about {p}% full.', ar: 'نسبة امتلائه حوالي {p}٪.' },
  ownerBoxNumber: {
    en: 'Give couriers your box\'s number{box}: {phone}\nWhen a driver messages it with the order number, they get the box location and a one-time code. Use your box\'s address as the delivery address.',
    ar: 'أعطِ شركات التوصيل رقم صندوقك{box}: {phone}\nعندما يراسله السائق برقم الطلب، يحصل على موقع الصندوق ورمز لمرة واحدة. استخدم عنوان صندوقك كعنوان للتوصيل.',
  },
  ownerBoxNumberShared: {
    en: 'Give couriers this WhatsApp number: {phone}\nWhen a driver messages it with the order number, they get your box location and a one-time code. Use your box\'s address as the delivery address, and register the order here so the box expects it.',
    ar: 'أعطِ شركات التوصيل رقم الواتساب هذا: {phone}\nعندما يراسله السائق برقم الطلب، يحصل على موقع صندوقك ورمز لمرة واحدة. استخدم عنوان صندوقك كعنوان للتوصيل، وسجّل الطلب هنا حتى ينتظره الصندوق.',
  },
  ownerReportAsk: {
    en: "Sorry to hear that. What's happened? Tell me in a sentence — for example the box won't open, a parcel is missing, or a parcel arrived damaged.",
    ar: 'يؤسفني ذلك. ماذا حدث؟ أخبرني في جملة — مثلًا الصندوق لا يفتح، أو طرد مفقود، أو وصل طرد تالف.',
  },
  ownerReported: {
    en: "I've reported this, reference {ticket}. The LLBox team will follow up, and you'll see it in your app.",
    ar: 'أبلغت عن ذلك، رقم المرجع {ticket}. سيتابع فريق LLBox الأمر، وستجده في تطبيقك.',
  },
  ownerReportedAlready: {
    en: "I've already reported this a few minutes ago (reference {ticket}). The team will follow up.",
    ar: 'أبلغت عن ذلك قبل دقائق (رقم المرجع {ticket}). سيتابع الفريق الأمر.',
  },
  ownerReportFailed: {
    en: "I couldn't file the report just now.",
    ar: 'لم أتمكن من تقديم البلاغ الآن.',
  },
  ownerTheftAdvice: {
    en: 'If you believe a parcel was stolen, please also contact the store or courier so they can open a claim.',
    ar: 'إذا كنت تعتقد أن الطرد سُرق، يرجى أيضًا التواصل مع المتجر أو شركة الشحن لفتح مطالبة.',
  },
  supportConfigured: {
    en: 'You can reach LLBox support here:\n{lines}',
    ar: 'يمكنك التواصل مع دعم LLBox عبر:\n{lines}',
  },
  supportNotConfigured: {
    en: "LLBox hasn't published a support line on this chat yet. In the meantime, in the LLBox app go to Settings, then Help.",
    ar: 'لم تنشر LLBox رقم دعم في هذه المحادثة بعد. في الأثناء، من تطبيق LLBox اذهب إلى الإعدادات ثم المساعدة.',
  },
  ownerAccountChange: {
    en: "I can't {what} from here, so I've passed your request to the LLBox team (reference {ticket}) and someone will come back to you.",
    ar: 'لا أستطيع {what} من هنا، لذا حوّلت طلبك إلى فريق LLBox (رقم المرجع {ticket}) وسيتواصل معك أحدهم.',
  },
  ownerCannotHelp: {
    en: "I'm not able to help with that one from here.",
    ar: 'لا أستطيع مساعدتك في هذا الأمر من هنا.',
  },
  ownerHuman: {
    en: "I'm LLBox's automated assistant and can't connect you to a person here. If something is wrong with your box or a parcel, tell me and I'll report it to the team.",
    ar: 'أنا المساعد الآلي لـ LLBox ولا أستطيع تحويلك إلى شخص من هنا. إذا كانت هناك مشكلة في صندوقك أو طرد، أخبرني وسأبلغ الفريق.',
  },
  ownerOptedOut: {
    en: "Done — I won't send you any messages unless you write to me first. Reply START any time to turn them back on.",
    ar: 'تم — لن أرسل لك أي رسائل ما لم تراسلني أولًا. أرسل START في أي وقت لإعادة تفعيلها.',
  },
  ownerOptedIn: {
    en: 'Done — messages from LLBox are back on.',
    ar: 'تم — أُعيد تفعيل رسائل LLBox.',
  },
  ownerDriverContactOff: {
    en: "Done — drivers won't be given your number. If a driver is stuck, I'll let you know in the app instead.",
    ar: 'تم — لن يُعطى رقمك للسائقين. إذا واجه سائق مشكلة، سأبلغك عبر التطبيق بدلًا من ذلك.',
  },
  ownerDriverContactOn: {
    en: 'Done — if a driver is stuck (cash on delivery, a box that won\'t respond, or a parcel too big for the box), I can give them your number for that delivery only.',
    ar: 'تم — إذا واجه سائق مشكلة (دفع عند الاستلام، أو صندوق لا يستجيب، أو طرد أكبر من الصندوق)، يمكنني إعطاؤه رقمك لذلك الطلب فقط.',
  },
  ownerPrefFailed: {
    en: "I couldn't update that just now. Please try again in a minute.",
    ar: 'لم أتمكن من تحديث ذلك الآن. يرجى المحاولة بعد دقيقة.',
  },
  ownerRefNotFound: {
    en: "I can't find {ref} among the deliveries on your box. Please check the number.",
    ar: 'لا أجد الطلب {ref} ضمن طلبات صندوقك. يرجى التحقق من الرقم.',
  },
  ownerCodWhich: {
    en: 'Which order is cash on delivery? Send its order number with "COD" and the amount.',
    ar: 'أي طلب دفعه عند الاستلام؟ أرسل رقم الطلب مع "COD" والمبلغ.',
  },
  ownerBoxTightGeneric: {
    en: 'Your box is getting busy on {dayName}, so it may get tight if the parcels are large.',
    ar: 'صندوقك مزدحم يوم {dayName}، وقد يضيق إذا كانت الطرود كبيرة.',
  },
  ownerOk: {
    en: 'No problem. Say "menu" any time to see what I can do.',
    ar: 'لا مشكلة. أرسل "القائمة" في أي وقت لترى ما يمكنني فعله.',
  },
  ownerSorry: {
    en: "Sorry for the trouble. Tell me what went wrong and I'll sort it out, or report it to the LLBox team.",
    ar: 'نعتذر عن الإزعاج. أخبرني ما المشكلة وسأحلها، أو أبلغ فريق LLBox بها.',
  },
  ownerUnavailable: {
    en: "I couldn't check that just now. Please try again in a minute.",
    ar: 'لم أتمكن من التحقق من ذلك الآن. يرجى المحاولة بعد دقيقة.',
  },
};

const DIVIDER = '\n\n—————\n\n';

const fill = (text, vars = {}) =>
  String(text || '').replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : ''));

/**
 * Render a template in the given language order (e.g. ['ar','en'] → Arabic, divider, English).
 * `vars` may be a function (lang) => vars for per-language values.
 */
const render = (key, mode = ['en'], vars = {}) => {
  const entry = T[key];
  if (!entry) throw new Error(`Unknown template: ${key}`);
  const langs = (mode && mode.length ? mode : ['en']).filter((l) => entry[l]);
  return langs
    .map((lang) => fill(entry[lang], typeof vars === 'function' ? vars(lang) : vars))
    .join(DIVIDER);
};

/** Render a template for a single language. */
const one = (key, lang = 'en', vars = {}) => render(key, [lang], vars);

module.exports = { T, render, one, DIVIDER };
