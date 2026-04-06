'use strict';

const { createProviderFromConfig } = require('../models/providers');
const { ValidationError, NotFoundError } = require('../utils/errors');

/**
 * ChatSendFlow is the reusable orchestration layer.
 * It coordinates:
 * 1) Persist user message
 * 2) Run model provider
 * 3) Execute tool calls (if any)
 * 4) Persist assistant/tool messages
 * 5) Return a structured response to UI
 */
class ChatSendFlow {
  constructor({ store, toolRegistry, confirmationService, log, config }) {
    this.store = store;
    this.toolRegistry = toolRegistry;
    this.confirmationService = confirmationService;
    this.log = log;
    this.config = config;
  }

  _loadSessionOrThrow(sessionId) {
    const session = this.store.getSession(sessionId);
    if (!session) throw new NotFoundError('Chat session not found', { sessionId });
    return session;
  }

  // PUBLIC_INTERFACE
  async run({ sessionId, content, providerConfigId = null, apiKey = null }) {
    /**
     * PUBLIC_INTERFACE
     * Execute one user->assistant turn.
     *
     * Inputs:
     * - sessionId: required
     * - content: required user message string
     * - providerConfigId: optional override; if not provided uses session provider_config_id
     * - apiKey: optional secret injected by host for remote providers
     *
     * Output:
     * - { session, messagesAppended: [...], model, toolResults: [...] }
     *
     * Errors:
     * - ValidationError, NotFoundError, ConfirmationRequiredError, generic Error
     */
    if (!sessionId) throw new ValidationError('sessionId is required');
    if (typeof content !== 'string' || !content.trim()) throw new ValidationError('content is required');

    const session = this._loadSessionOrThrow(sessionId);

    const effectiveProviderId = providerConfigId || session.providerConfigId || this.config.defaultProviderId;

    const providerConfig =
      effectiveProviderId === 'local_stub'
        ? { providerType: 'local', modelDefault: 'local-stub' }
        : this.store.getProviderConfig(effectiveProviderId);

    if (effectiveProviderId !== 'local_stub' && !providerConfig) {
      throw new NotFoundError('Provider config not found', { providerConfigId: effectiveProviderId });
    }

    const provider = createProviderFromConfig(providerConfig, { apiKey });
    const tools = this.toolRegistry.listTools().map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    this.log.info('chat_send_start', { sessionId, providerId: effectiveProviderId });

    const appended = [];
    const userMsg = this.store.addMessage({
      sessionId,
      role: 'user',
      content,
      contentJson: null,
    });
    appended.push(userMsg);

    const history = this.store.listMessages(sessionId, { limit: 200, offset: 0 }).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const completion = await provider.generateChatCompletion({ messages: history, tools });
    const assistantMsg = this.store.addMessage({
      sessionId,
      role: 'assistant',
      content: completion.assistantMessage.content || '',
      contentJson: completion.toolCalls && completion.toolCalls.length ? { toolCalls: completion.toolCalls } : null,
    });
    appended.push(assistantMsg);

    const toolResults = [];
    // Execute tool calls sequentially for determinism.
    for (const call of completion.toolCalls || []) {
      if (call.function?.name === 'request_confirmation') {
        await this.confirmationService.requireConfirmation({
          operation: call.function?.arguments?.operation || 'unknown',
          request: { toolCall: call },
        });
      }

      const result = await this.toolRegistry.executeToolCall(call);
      toolResults.push(result);

      const toolMsg = this.store.addMessage({
        sessionId,
        role: 'tool',
        content: result.resultJson,
        contentJson: { toolCallId: result.toolCallId, name: result.name, result: result.result },
      });
      appended.push(toolMsg);
    }

    this.log.info('chat_send_end', {
      sessionId,
      providerId: effectiveProviderId,
      toolCalls: (completion.toolCalls || []).length,
    });

    return {
      session: this.store.getSession(sessionId),
      model: completion.model,
      messagesAppended: appended,
      toolResults,
    };
  }
}

module.exports = {
  ChatSendFlow,
};
