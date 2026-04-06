'use strict';

const { loadConfig } = require('./config');
const { SQLiteStore } = require('./db/sqlite');
const { createDefaultToolRegistry } = require('./tools/toolRegistry');
const { child } = require('./utils/logger');
const { ConfirmationService } = require('./services/confirmations');
const { ChatSendFlow } = require('./flows/chatFlow');
const { SettingsController } = require('./controllers/settings');
const { ChatController } = require('./controllers/chat');
const { ConfirmationsController } = require('./controllers/confirmations');
const { TelemetryController } = require('./controllers/telemetry');

// PUBLIC_INTERFACE
function composeAppServices({ env = process.env } = {}) {
  /**
   * PUBLIC_INTERFACE
   * Composition root used by app.js and tests.
   */
  const config = loadConfig(env);
  const log = child({ service: 'node_backend' });

  const store = new SQLiteStore(config.sqliteDbPath);
  const toolRegistry = createDefaultToolRegistry();

  const confirmationService = new ConfirmationService({ store, log: child({ flow: 'confirmations' }) });
  const chatSendFlow = new ChatSendFlow({
    store,
    toolRegistry,
    confirmationService,
    log: child({ flow: 'chat_send' }),
    config,
  });

  const controllers = {
    settings: new SettingsController({ store, log: child({ controller: 'settings' }) }),
    chat: new ChatController({ store, chatSendFlow, log: child({ controller: 'chat' }) }),
    confirmations: new ConfirmationsController({ confirmationService, store }),
    telemetry: new TelemetryController({ store, log: child({ controller: 'telemetry' }) }),
  };

  return { config, store, toolRegistry, controllers, log };
}

module.exports = {
  composeAppServices,
};
