const axios = require('axios');
const logger = require('../config/logger');

/**
 * Twilio Voice client.
 * Phase 1: dummy responses. Wire real API in Phase 2.
 */
class TwilioService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    this.dummyMode = !this.accountSid || !this.authToken;
  }

  get authHeader() {
    const token = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    return `Basic ${token}`;
  }

  async getCall(callSid) {
    if (this.dummyMode) {
      logger.info(`[DUMMY] Twilio getCall: ${callSid}`);
      return {
        sid: callSid || 'CA_DUMMY_SID',
        status: 'completed',
        duration: '120',
        from: '+966500000001',
        to: this.phoneNumber || '+966511111111',
        mode: 'dummy',
      };
    }

    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${callSid}.json`,
      { headers: { Authorization: this.authHeader } }
    );

    return response.data;
  }

  async getRecording(callSid) {
    if (this.dummyMode) {
      logger.info(`[DUMMY] Twilio getRecording: ${callSid}`);
      return {
        recordingUrl: `https://api.twilio.com/dummy/recordings/${callSid}`,
        mode: 'dummy',
      };
    }

    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls/${callSid}/Recordings.json`,
      { headers: { Authorization: this.authHeader } }
    );

    return response.data;
  }
}

module.exports = new TwilioService();
