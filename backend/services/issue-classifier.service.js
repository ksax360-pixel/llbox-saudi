/**
 * Model fallback for a driver's problem when the keyword rules find none (Test Report 2026-10-04 R1:
 * Roman Hindi / Hinglish problems were ignored). Classification only — the model never writes a reply.
 */

const axios = require('axios');
const logger = require('../config/logger');

const ISSUES = [
  'code_not_working',
  'parcel_too_large',
  'box_full',
  'cannot_find_box',
  'customer_no_answer',
  'contact_request',
  'off_box',
  'cod',
  'completed',
  'none',
];

const SYSTEM = `You classify one WhatsApp message from a delivery driver at a customer's smart parcel box (LLBox).
The message may be in English, Arabic, Arabizi, Urdu, Hindi, or Roman Hindi/Urdu (e.g. "code nahi chal raha", "box nahi mil raha").
Return JSON {"issue": "<one of: ${ISSUES.join(', ')}>"}:
- code_not_working: the code/OTP/keypad is refused, the box will not open, or the box seems dead
- parcel_too_large: the parcel does not fit in the box
- box_full: the box is already full
- cannot_find_box: cannot find the box / address / gate closed
- customer_no_answer: the customer does not answer or is not home
- contact_request: asks for the customer's phone number
- off_box: wants to leave the parcel with a guard, neighbour, reception or at the door
- cod: the order is cash on delivery / the driver must collect payment
- completed: says the parcel was delivered / put in the box
- none: only giving an order number, greeting, or anything else
Order numbers are not problems. Answer with the JSON only.`;

const cache = new Map();

/** Roman Hindi/Urdu or a long free-text sentence: worth a second look when the rules found nothing. */
const looksLikePastedLabel = (s = '') =>
  /\b(shipment\s*no|consignee|awb|waybill|tracking\s*no|weight|pieces?|pcs|cod\s*[:\-]|mob\.?|tel\.?|invoice)\b/i.test(s) ||
  (/\bcod\s*[:\-]/i.test(s) && /\b(weight|kg|consignee|shipment)\b/i.test(s));

const worthClassifying = (text = '', refs = []) => {
  let s = String(text || '').toLowerCase();
  for (const r of refs) s = s.split(String(r).toLowerCase()).join(' ');
  const words = s.match(/[a-z\u0600-\u06FF\u0900-\u097F']+/g) || [];
  if (words.length < 3) return false;
  // Pasted courier labels: extract the reference only; never ask the model to invent a COD/problem intent (D37).
  if (looksLikePastedLabel(s)) return false;
  const roman = /\b(hai|hain|nahi|nahin|nhi|nai|raha|rahi|rha|kya|kaise|kaha|kahan|bhai|karo|kar|mein|hua|gaya|gayi|wala|kuch|abhi|yahan|wahan|bahut|bohot|chahiye|mera|meri|aap|tum)\b/.test(s);
  // Only problem-shaped messages: the model classifies issues, it must not reinterpret questions or requests.
  const trouble =
    /\b(not|no|nahi|nahin|nhi|nai|never|can'?t|cannot|won'?t|wont|doesn'?t|dosent|didn'?t|isn'?t|problem|issue|stuck|wrong|broken|dead|full|big|bada|chhota|band|khul|khula|paisa|paise|cash|cod|wait|waiting|answer|phone|call)\b/.test(s) ||
    /(ما |مو |مش |لا |مشكلة|خربان|ممتلئ|كبير|كاش|نقد)/.test(s);
  return trouble && (roman || words.length >= 8);
};

const classify = async (text) => {
  const key = String(text || '').trim().toLowerCase().slice(0, 500);
  if (!key || !process.env.OPENAI_API_KEY) return 'none';
  if (cache.has(key)) return cache.get(key);
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.ISSUE_CLASSIFIER_MODEL || 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 20,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: key },
        ],
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 6000 }
    );
    const raw = response.data?.choices?.[0]?.message?.content || '{}';
    const issue = ISSUES.includes(JSON.parse(raw).issue) ? JSON.parse(raw).issue : 'none';
    cache.set(key, issue);
    if (cache.size > 2000) cache.delete(cache.keys().next().value);
    logger.info(`[classify] model issue=${issue} for "${key.slice(0, 60)}"`);
    return issue;
  } catch (error) {
    logger.warn(`[classify] model failed: ${error.message}`);
    return 'none';
  }
};

module.exports = { classify, worthClassifying, looksLikePastedLabel };
