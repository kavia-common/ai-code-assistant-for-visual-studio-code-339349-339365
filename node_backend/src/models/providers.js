'use strict';

const { ValidationError } = require('../utils/errors');

/**
 * Provider abstraction:
 * - input messages: [{ role, content }]
 * - tools: OpenAI compatible tools list (functions)
 * - returns: { assistantMessage, toolCalls? }
 */

function _requireString(v, name) {
  if (!v || typeof v !== 'string') throw new ValidationError(`${name} must be a string`);
  return v;
}

class LocalStubProvider {
  constructor({ model = 'local-stub' } = {}) {
    this.model = model;
  }

  // PUBLIC_INTERFACE
  async generateChatCompletion({ messages, tools }) {
    /**
     * PUBLIC_INTERFACE
     * Deterministic local stub:
     * - if user says "use tool:echo ..." => creates a tool call to echo
     * - else replies with a simple assistant echo.
     */
    const last = messages[messages.length - 1];
    const content = last ? String(last.content || '') : '';
    const toolPrefix = 'use tool:echo';
    if (content.toLowerCase().startsWith(toolPrefix)) {
      const text = content.slice(toolPrefix.length).trim() || 'hello';
      return {
        model: this.model,
        assistantMessage: {
          role: 'assistant',
          content: 'Calling tool echo...',
        },
        toolCalls: [
          {
            id: `call_${Date.now()}`,
            type: 'function',
            function: {
              name: 'echo',
              arguments: JSON.stringify({ text }),
            },
          },
        ],
      };
    }

    const availableTools = (tools || []).map((t) => t.function?.name || t.name).filter(Boolean);
    return {
      model: this.model,
      assistantMessage: {
        role: 'assistant',
        content:
          `LocalStubProvider reply. You said: "${content}".` +
          (availableTools.length ? ` Tools available: ${availableTools.join(', ')}.` : ''),
      },
      toolCalls: [],
    };
  }
}

class OpenAICompatProvider {
  constructor({ baseUrl, apiKey = null, model = 'gpt-4o-mini' } = {}) {
    this.baseUrl = baseUrl || 'https://api.openai.com/v1';
    this.apiKey = apiKey; // should come from VS Code SecretStorage in real deployment
    this.model = model;
  }

  // PUBLIC_INTERFACE
  async generateChatCompletion({ messages, tools }) {
    /**
     * PUBLIC_INTERFACE
     * OpenAI-compatible chat completion.
     *
     * This is a structure-compatible implementation; if apiKey is missing we raise validation error.
     * NOTE: We intentionally avoid adding fetch polyfills; Node 18 has global fetch.
     */
    if (!this.apiKey) {
      throw new ValidationError(
        'OpenAICompatProvider requires apiKey (must be injected by host, not stored in SQLite).'
      );
    }

    const url = new URL('/chat/completions', this.baseUrl).toString();
    const body = {
      model: this.model,
      messages: (messages || []).map((m) => ({
        role: _requireString(m.role, 'message.role'),
        content: _requireString(m.content, 'message.content'),
      })),
      tools: (tools || []).map((t) => {
        // allow either {name,description,parameters} or already-openai-shape
        if (t.type === 'function' && t.function) return t;
        return {
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        };
      }),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAICompatProvider HTTP ${res.status}: ${text}`);
    }

    const data = await res.json();
    const choice = data.choices && data.choices[0];
    const msg = choice && choice.message;
    return {
      model: data.model || this.model,
      assistantMessage: { role: 'assistant', content: msg?.content || '' },
      toolCalls: msg?.tool_calls || [],
    };
  }
}

// PUBLIC_INTERFACE
function createProviderFromConfig(providerConfig, { apiKey = null } = {}) {
  /**
   * PUBLIC_INTERFACE
   * Create provider instance from provider_config row (SQLite metadata).
   */
  if (!providerConfig) {
    return new LocalStubProvider();
  }
  if (providerConfig.providerType === 'local') {
    return new LocalStubProvider({ model: providerConfig.modelDefault || 'local-stub' });
  }
  if (providerConfig.providerType === 'openai_compat') {
    return new OpenAICompatProvider({
      baseUrl: providerConfig.baseUrl,
      apiKey,
      model: providerConfig.modelDefault || 'gpt-4o-mini',
    });
  }
  // Default fallback: local stub
  return new LocalStubProvider({ model: 'local-stub' });
}

module.exports = {
  LocalStubProvider,
  OpenAICompatProvider,
  createProviderFromConfig,
};
