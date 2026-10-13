require('dotenv').config();

const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const Locker = require('../models/Locker');
const Delivery = require('../models/Delivery');
const WhatsAppContact = require('../models/WhatsAppContact');
const Conversation = require('../models/Conversation');
const opsService = require('../services/ops.service');
const llboxService = require('../services/llbox.service');

(async () => {
  await connectDatabase();

  await opsService.upsertLockerFromBox({
    boxId: 2,
    box_code: 'BOX-001',
    address: 'Olaya, Riyadh',
    latitude: 24.7136,
    longitude: 46.6753,
    box_status: 'in_use',
  });

  await opsService.upsertLockerFromBox({
    boxId: 3,
    box_code: 'QA-PROD-TEST-BOX',
    address: 'PRODUCTION TEST BOX -- NOT REAL HARDWARE -- safe for X360 simulator journey tests',
    latitude: 24.7,
    longitude: 46.6,
    box_status: 'in_use',
  });

  const contacts = await WhatsAppContact.find({});
  for (const contact of contacts) {
    try {
      const data = await llboxService.findCustomer({ whatsappPhone: contact.phone });
      await opsService.recordFindCustomer({ whatsappPhone: contact.phone }, data);
      if (contact.lastOrderReference) {
        await opsService.recordRegister({
          whatsappPhone: contact.phone,
          orderReference: contact.lastOrderReference,
          boxId: data.boxes?.[0]?.boxId,
          boxCode: data.boxes?.[0]?.boxCode || data.locker,
          customerName: contact.name || data.name,
        });
      }
    } catch (error) {
      console.log(`lookup ${contact.phone}: ${error.message}`);
    }
  }

  const conversations = await Conversation.find({});
  for (const convo of conversations) {
    for (const call of convo.toolCalls || []) {
      const input = call.input || {};
      const output = call.output || {};
      const ref = input.orderReference || output.orderReference;
      if (call.toolName === 'register-delivery' && ref) {
        await opsService.recordRegister({
          whatsappPhone: input.whatsappPhone || convo.callerNumber,
          orderReference: ref,
          boxId: input.boxId || output.boxId,
          boxCode: output.boxCode,
        });
      }
      if (call.toolName === 'resolve-delivery' && ref) {
        await opsService.recordResolve(ref, output);
      }
      if (call.toolName === 'confirm-delivery') {
        await opsService.recordConfirm(input, output);
      }
    }
  }

  console.log('lockers', await Locker.countDocuments());
  console.log('deliveries', await Delivery.countDocuments());
  await mongoose.connection.close();
  process.exit(0);
})().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
