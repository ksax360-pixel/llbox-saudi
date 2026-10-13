const axios = require('axios');
const logger = require('../config/logger');
const { digitsOnly } = require('../utils/phone');

class WhatsAppService {
  getConfig() {
    return {
      token: process.env.WHATSAPP_TOKEN,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      templateName: process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'llb_otp',
      templateLang: process.env.WHATSAPP_OTP_TEMPLATE_LANG || 'en',
    };
  }

  isConfigured() {
    const { token, phoneNumberId } = this.getConfig();
    return Boolean(token && phoneNumberId);
  }

  async sendAuthenticationOtp(toPhone, code) {
    const { token, phoneNumberId, templateName, templateLang } = this.getConfig();
    if (!token || !phoneNumberId) {
      throw new Error('WhatsApp is not configured on the server');
    }

    const to = digitsOnly(toPhone);
    if (!to) {
      throw new Error('Invalid phone number');
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const payloads = [
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [{ type: 'text', text: code }],
            },
          ],
        },
      },
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: templateLang },
          components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }],
        },
      },
    ];

    let lastError = null;
    for (const body of payloads) {
      try {
        const response = await axios.post(url, body, { headers, validateStatus: () => true });
        if (response.status >= 200 && response.status < 300) {
          logger.info(`WhatsApp auth OTP sent to ${to.slice(-4).padStart(to.length, '*')}`);
          return response.data;
        }
        lastError = new Error(response.data?.error?.message || `WhatsApp API ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Failed to send WhatsApp OTP');
  }

  /** Free-form text (only delivered inside the 24-hour customer-service window). */
  async sendText(toPhone, text) {
    const { token, phoneNumberId } = this.getConfig();
    if (!token || !phoneNumberId) throw new Error('WhatsApp is not configured on the server');
    const to = digitsOnly(toPhone);
    if (!to || !String(text || '').trim()) throw new Error('Invalid WhatsApp message');
    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body: String(text).slice(0, 4096) } },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, validateStatus: () => true, timeout: 20000 }
    );
    if (response.status >= 200 && response.status < 300) {
      logger.info(`[followup] WhatsApp text sent to ${to.slice(-4).padStart(to.length, '*')}`);
      return response.data;
    }
    throw new Error(response.data?.error?.message || `WhatsApp API ${response.status}`);
  }
}

module.exports = new WhatsAppService();
