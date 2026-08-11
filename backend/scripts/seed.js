require('dotenv').config();

const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const User = require('../models/User');
const Knowledge = require('../models/Knowledge');
const Prompt = require('../models/Prompt');
const Setting = require('../models/Setting');
const Conversation = require('../models/Conversation');
const CallLog = require('../models/CallLog');
const { ROLES, PROMPT_TYPES, SETTING_CATEGORIES, CALL_STATUS } = require('../utils/constants');
const logger = require('../config/logger');

const seed = async () => {
  await connectDatabase();

  logger.info('Clearing existing seed collections...');
  await Promise.all([
    User.deleteMany({}),
    Knowledge.deleteMany({}),
    Prompt.deleteMany({}),
    Setting.deleteMany({}),
    Conversation.deleteMany({}),
    CallLog.deleteMany({}),
  ]);

  const [admin, operator, viewer] = await User.create([
    {
      name: 'Platform Admin',
      email: 'admin@llbox.ai',
      password: 'Admin@123',
      role: ROLES.ADMIN,
    },
    {
      name: 'Voice Operator',
      email: 'operator@llbox.ai',
      password: 'Operator@123',
      role: ROLES.OPERATOR,
    },
    {
      name: 'Read Only Viewer',
      email: 'viewer@llbox.ai',
      password: 'Viewer@123',
      role: ROLES.VIEWER,
    },
  ]);

  await Knowledge.create([
    {
      title: 'How to open an LLBox locker',
      content:
        'Ask the driver for the order reference, resolve the delivery to get an OTP, then instruct the driver to enter the code on the box keypad.',
      category: 'delivery',
      tags: ['otp', 'locker', 'driver'],
      language: 'en',
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      title: 'كيفية فتح صندوق LLBox',
      content: 'اطلب من السائق رقم الطلب، ثم أعطه رمز OTP لإدخاله على لوحة المفاتيح.',
      category: 'delivery',
      tags: ['otp', 'arabic'],
      language: 'ar',
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      title: 'Register delivery via WhatsApp',
      content:
        'Look up the customer by WhatsApp number. If multiple boxes are linked, ask which box. Then register the expected delivery with the order reference.',
      category: 'whatsapp',
      tags: ['registration', 'whatsapp'],
      language: 'en',
      createdBy: operator._id,
      updatedBy: operator._id,
    },
  ]);

  await Prompt.create([
    {
      name: 'Default System Prompt',
      type: PROMPT_TYPES.SYSTEM,
      language: 'en',
      content:
        'You are the LLBox AI voice agent. Help drivers resolve deliveries and customers register expected deliveries. Never invent OTPs — always call the resolve-delivery tool.',
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      name: 'Greeting EN',
      type: PROMPT_TYPES.GREETING,
      language: 'en',
      content: 'Hello! Welcome to LLBox delivery support. How can I help you today?',
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      name: 'Greeting AR',
      type: PROMPT_TYPES.GREETING,
      language: 'ar',
      content: 'مرحباً بك في دعم توصيل LLBox. كيف يمكنني مساعدتك؟',
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      name: 'Fallback Prompt',
      type: PROMPT_TYPES.FALLBACK,
      language: 'en',
      content: "I'm sorry, I didn't catch that. Could you please repeat your order reference or question?",
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      name: 'Language Switch',
      type: PROMPT_TYPES.LANGUAGE,
      language: 'en',
      content: 'I can continue in English or Arabic. Which do you prefer?',
      createdBy: admin._id,
      updatedBy: admin._id,
    },
  ]);

  await Setting.create([
    {
      key: 'twilio.account_sid',
      category: SETTING_CATEGORIES.TWILIO,
      value: '',
      label: 'Twilio Account SID',
      isSecret: true,
      updatedBy: admin._id,
    },
    {
      key: 'twilio.auth_token',
      category: SETTING_CATEGORIES.TWILIO,
      value: '',
      label: 'Twilio Auth Token',
      isSecret: true,
      updatedBy: admin._id,
    },
    {
      key: 'twilio.phone_number',
      category: SETTING_CATEGORIES.TWILIO,
      value: '+966500000000',
      label: 'Twilio Phone Number',
      updatedBy: admin._id,
    },
    {
      key: 'elevenlabs.api_key',
      category: SETTING_CATEGORIES.ELEVENLABS,
      value: '',
      label: 'ElevenLabs API Key',
      isSecret: true,
      updatedBy: admin._id,
    },
    {
      key: 'elevenlabs.agent_id',
      category: SETTING_CATEGORIES.ELEVENLABS,
      value: '',
      label: 'ElevenLabs Agent ID',
      updatedBy: admin._id,
    },
    {
      key: 'llbox.base_url',
      category: SETTING_CATEGORIES.LLBOX,
      value: 'https://llbox.up.railway.app/api/v1',
      label: 'LLBox Base URL',
      updatedBy: admin._id,
    },
    {
      key: 'llbox.api_key',
      category: SETTING_CATEGORIES.LLBOX,
      value: '',
      label: 'LLBox Agent API Key',
      isSecret: true,
      updatedBy: admin._id,
    },
    {
      key: 'google_maps.api_key',
      category: SETTING_CATEGORIES.GOOGLE_MAPS,
      value: '',
      label: 'Google Maps API Key',
      isSecret: true,
      updatedBy: admin._id,
    },
    {
      key: 'openai.api_key',
      category: SETTING_CATEGORIES.OPENAI,
      value: '',
      label: 'OpenAI API Key',
      isSecret: true,
      updatedBy: admin._id,
    },
  ]);

  const callLog = await CallLog.create({
    incomingNumber: '+966500000001',
    twilioCallSid: 'CA_SEED_DUMMY_001',
    elevenLabsConversationId: 'conv_seed_001',
    status: CALL_STATUS.COMPLETED,
    duration: 95,
    recordingUrl: 'https://example.com/recordings/seed-001.mp3',
    startedAt: new Date(Date.now() - 5 * 60 * 1000),
    endedAt: new Date(),
    direction: 'inbound',
  });

  await Conversation.create({
    callerNumber: '+966500000001',
    transcript:
      'Agent: Hello, how can I help?\nDriver: Order ABC123\nAgent: Deliver to Building A. Enter code 4589.',
    duration: 95,
    language: 'en',
    intent: 'resolve_delivery',
    toolCalls: [
      {
        toolName: 'resolve-delivery',
        input: { orderReference: 'ABC123' },
        output: { success: true, otp: '4589' },
        success: true,
      },
    ],
    response: 'Deliver to Building A. Enter code 4589 on the keypad.',
    status: 'completed',
    callLogId: callLog._id,
    createdBy: operator._id,
  });

  logger.info('Seed complete');
  logger.info('--- Demo accounts ---');
  logger.info(`Admin:    admin@llbox.ai / Admin@123`);
  logger.info(`Operator: operator@llbox.ai / Operator@123`);
  logger.info(`Viewer:   viewer@llbox.ai / Viewer@123`);
  logger.info(`Viewer id (unused): ${viewer._id}`);

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch(async (error) => {
  logger.error(`Seed failed: ${error.message}`);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
