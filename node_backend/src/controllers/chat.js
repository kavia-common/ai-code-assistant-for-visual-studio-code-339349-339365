'use strict';

const { ValidationError, NotFoundError } = require('../utils/errors');

class ChatController {
  constructor({ store, chatSendFlow, log }) {
    this.store = store;
    this.chatSendFlow = chatSendFlow;
    this.log = log;
  }

  createSession(req, res) {
    const { title = null, providerConfigId = null } = req.body || {};
    const session = this.store.createSession({ title, providerConfigId });
    return res.status(201).json(session);
  }

  listSessions(req, res) {
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const items = this.store.listSessions({ limit, offset });
    return res.status(200).json({ items, limit, offset });
  }

  getSession(req, res) {
    const sessionId = req.params.sessionId;
    const session = this.store.getSession(sessionId);
    if (!session) throw new NotFoundError('Chat session not found', { sessionId });
    return res.status(200).json(session);
  }

  listMessages(req, res) {
    const sessionId = req.params.sessionId;
    const session = this.store.getSession(sessionId);
    if (!session) throw new NotFoundError('Chat session not found', { sessionId });

    const limit = Math.min(Number(req.query.limit || 200), 500);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const items = this.store.listMessages(sessionId, { limit, offset });
    return res.status(200).json({ items, limit, offset });
  }

  async sendMessage(req, res) {
    const sessionId = req.params.sessionId;
    const { content, providerConfigId = null, apiKey = null } = req.body || {};
    if (!content) throw new ValidationError('content is required');

    // apiKey is accepted to keep interfaces suitable for extension bridge usage
    // (in production, key should be injected via extension host, not from webview).
    const result = await this.chatSendFlow.run({ sessionId, content, providerConfigId, apiKey });
    return res.status(200).json(result);
  }
}

module.exports = {
  ChatController,
};
