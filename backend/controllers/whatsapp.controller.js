const WhatsAppContact = require('../models/WhatsAppContact');
const { success, fail } = require('../utils/response');
const { normalizePhone, digitsOnly } = require('../utils/phone');
const { HTTP_STATUS } = require('../utils/constants');

const listContacts = async (req, res, next) => {
  try {
    const contacts = await WhatsAppContact.find({}).sort({ updatedAt: -1 }).limit(200).lean();
    return success(res, { contacts });
  } catch (error) {
    return next(error);
  }
};

const lookupContact = async (req, res, next) => {
  try {
    const raw = req.body.phone || req.query.phone || req.params.phone;
    const phoneDigits = digitsOnly(raw);

    if (!phoneDigits) {
      return fail(res, 'phone is required', HTTP_STATUS.BAD_REQUEST);
    }

    const contact = await WhatsAppContact.findOne({ phoneDigits });

    if (!contact) {
      return success(res, {
        found: false,
        registered: false,
        phone: normalizePhone(raw),
        phoneDigits,
        contact: null,
      });
    }

    return success(res, {
      found: true,
      registered: Boolean(contact.name),
      phone: contact.phone,
      phoneDigits: contact.phoneDigits,
      contact,
    });
  } catch (error) {
    return next(error);
  }
};

const upsertContact = async (req, res, next) => {
  try {
    const raw = req.body.phone;
    const phoneDigits = digitsOnly(raw);

    if (!phoneDigits) {
      return fail(res, 'phone is required', HTTP_STATUS.BAD_REQUEST);
    }

    const updates = {
      phone: normalizePhone(raw),
      phoneDigits,
      lastMessageAt: new Date(),
    };

    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      updates.name = req.body.name.trim();
      updates.awaitingName = false;
    }

    if (typeof req.body.awaitingName === 'boolean') {
      updates.awaitingName = req.body.awaitingName;
    }

    if (typeof req.body.lastIntent === 'string') {
      updates.lastIntent = req.body.lastIntent;
    }

    if (typeof req.body.lastOrderReference === 'string') {
      updates.lastOrderReference = req.body.lastOrderReference;
    }

    if (typeof req.body.lastInboundText === 'string') {
      updates.lastInboundText = req.body.lastInboundText.slice(0, 1000);
    }

    const contact = await WhatsAppContact.findOneAndUpdate(
      { phoneDigits },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return success(res, {
      found: true,
      registered: Boolean(contact.name),
      contact,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listContacts,
  lookupContact,
  upsertContact,
};
