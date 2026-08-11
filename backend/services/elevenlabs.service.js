const axios = require('axios');
const logger = require('../config/logger');

/**
 * ElevenLabs Conversational AI client.
 * Phase 1: dummy responses. Wire real API in Phase 2.
 */
class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.agentId = process.env.ELEVENLABS_AGENT_ID;
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.dummyMode = !this.apiKey;
  }

  async getConversation(conversationId) {
    if (this.dummyMode) {
      logger.info(`[DUMMY] ElevenLabs getConversation: ${conversationId}`);
      return {
        conversationId,
        status: 'done',
        transcript: [
          { role: 'agent', message: 'Hello, how can I help with your delivery?' },
          { role: 'user', message: 'My order reference is ABC123' },
        ],
        mode: 'dummy',
      };
    }

    const response = await axios.get(`${this.baseUrl}/convai/conversations/${conversationId}`, {
      headers: { 'xi-api-key': this.apiKey },
    });

    return response.data;
  }

  async listConversations(limit = 20) {
    if (this.dummyMode) {
      logger.info('[DUMMY] ElevenLabs listConversations');
      return {
        conversations: [],
        mode: 'dummy',
      };
    }

    const response = await axios.get(`${this.baseUrl}/convai/conversations`, {
      headers: { 'xi-api-key': this.apiKey },
      params: { agent_id: this.agentId, page_size: limit },
    });

    return response.data;
  }
}

module.exports = new ElevenLabsService();
