const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VS Code AI Assistant Backend',
      version: '1.0.0',
      description:
        'Local backend for orchestration, tool-calling, settings, chat history, confirmations, and telemetry opt-in.',
    },
    tags: [
      { name: 'Settings' },
      { name: 'Chat' },
      { name: 'Confirmations' },
      { name: 'Telemetry' },
    ],
  },
  apis: ['./src/routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);
module.exports = swaggerSpec;
