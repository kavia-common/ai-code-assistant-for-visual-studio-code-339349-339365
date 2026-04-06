'use strict';

const { ValidationError } = require('../utils/errors');

/**
 * Tool registry and adapters.
 *
 * We keep a stable "tool call" envelope that is compatible with OpenAI function calling style:
 * { id, type: 'function', function: { name, arguments: <json string> } }
 */

function _asJsonString(obj) {
  return JSON.stringify(obj === undefined ? null : obj);
}

// PUBLIC_INTERFACE
function createDefaultToolRegistry() {
  /**
   * PUBLIC_INTERFACE
   * Returns a registry with safe stub tools suitable for UI integration.
   *
   * NOTE: Real filesystem/command execution must be implemented in the VS Code extension
   * host side. Here we provide stubs so backend contracts are stable.
   */
  const tools = new Map();

  tools.set('echo', {
    description: 'Echo the given text.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to echo' } },
      required: ['text'],
    },
    handler: async ({ text }) => ({ text }),
  });

  tools.set('request_confirmation', {
    description:
      'Request a user confirmation for a sensitive operation (backend will convert into confirmation workflow).',
    parameters: {
      type: 'object',
      properties: {
        operation: { type: 'string', description: 'Operation name' },
        scope: { type: 'string', description: 'Optional scope (file path / command)' },
        request: { type: 'object', description: 'Structured details to show to user' },
      },
      required: ['operation', 'request'],
    },
    handler: async () => {
      throw new ValidationError(
        'request_confirmation is a reserved tool name and must be handled by orchestration layer.'
      );
    },
  });

  return {
    listTools: () =>
      Array.from(tools.entries()).map(([name, t]) => ({
        name,
        description: t.description,
        parameters: t.parameters,
      })),

    getTool: (name) => tools.get(name),

    // Execute tool call in canonical shape.
    executeToolCall: async (call) => {
      if (!call || !call.function || !call.function.name) {
        throw new ValidationError('Invalid tool call envelope', { call });
      }
      const toolName = call.function.name;
      const tool = tools.get(toolName);
      if (!tool) {
        throw new ValidationError(`Unknown tool: ${toolName}`);
      }
      let args = {};
      if (call.function.arguments) {
        try {
          args = JSON.parse(call.function.arguments);
        } catch (e) {
          throw new ValidationError(`Invalid JSON arguments for tool ${toolName}`, {
            raw: call.function.arguments,
          });
        }
      }
      const result = await tool.handler(args);
      return {
        toolCallId: call.id || null,
        name: toolName,
        result,
        resultJson: _asJsonString(result),
      };
    },
  };
}

module.exports = {
  createDefaultToolRegistry,
};
