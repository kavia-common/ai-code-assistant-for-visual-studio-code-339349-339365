'use strict';

const express = require('express');

function createApiRouter(controllers) {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   - name: Settings
   *   - name: Chat
   *   - name: Confirmations
   *   - name: Telemetry
   */

  /**
   * @swagger
   * /api/settings:
   *   get:
   *     tags: [Settings]
   *     summary: List all settings
   *     responses:
   *       200:
   *         description: Settings list
   */
  router.get('/settings', controllers.settings.list.bind(controllers.settings));

  /**
   * @swagger
   * /api/settings/{key}:
   *   get:
   *     tags: [Settings]
   *     summary: Get a setting by key
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Setting
   */
  router.get('/settings/:key', controllers.settings.get.bind(controllers.settings));

  /**
   * @swagger
   * /api/settings/{key}:
   *   put:
   *     tags: [Settings]
   *     summary: Upsert a setting by key
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               value: {}
   *             required: [value]
   *     responses:
   *       200:
   *         description: Updated setting
   */
  router.put('/settings/:key', controllers.settings.upsert.bind(controllers.settings));

  /**
   * @swagger
   * /api/chat/sessions:
   *   post:
   *     tags: [Chat]
   *     summary: Create a chat session
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title: { type: string }
   *               providerConfigId: { type: string }
   *     responses:
   *       201:
   *         description: Session created
   *   get:
   *     tags: [Chat]
   *     summary: List chat sessions
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 50 }
   *       - in: query
   *         name: offset
   *         schema: { type: integer, default: 0 }
   *     responses:
   *       200:
   *         description: Session list
   */
  router.post('/chat/sessions', controllers.chat.createSession.bind(controllers.chat));
  router.get('/chat/sessions', controllers.chat.listSessions.bind(controllers.chat));

  /**
   * @swagger
   * /api/chat/sessions/{sessionId}:
   *   get:
   *     tags: [Chat]
   *     summary: Get session
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Session
   */
  router.get('/chat/sessions/:sessionId', controllers.chat.getSession.bind(controllers.chat));

  /**
   * @swagger
   * /api/chat/sessions/{sessionId}/messages:
   *   get:
   *     tags: [Chat]
   *     summary: List messages for a session
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema: { type: string }
   *       - in: query
   *         name: limit
   *         schema: { type: integer, default: 200 }
   *       - in: query
   *         name: offset
   *         schema: { type: integer, default: 0 }
   *     responses:
   *       200:
   *         description: Messages
   */
  router.get('/chat/sessions/:sessionId/messages', controllers.chat.listMessages.bind(controllers.chat));

  /**
   * @swagger
   * /api/chat/sessions/{sessionId}/messages:
   *   post:
   *     tags: [Chat]
   *     summary: Send a user message and get assistant response (may include tool calls)
   *     description: |
   *       Returns 409 with code CONFIRMATION_REQUIRED if a sensitive operation needs user approval.
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               content: { type: string }
   *               providerConfigId: { type: string }
   *               apiKey:
   *                 type: string
   *                 description: Secret injected by host (do not store in SQLite)
   *             required: [content]
   *     responses:
   *       200:
   *         description: Chat turn result
   *       409:
   *         description: Confirmation required
   */
  router.post('/chat/sessions/:sessionId/messages', controllers.chat.sendMessage.bind(controllers.chat));

  /**
   * @swagger
   * /api/confirmations/{confirmationId}:
   *   get:
   *     tags: [Confirmations]
   *     summary: Get a confirmation request
   *     parameters:
   *       - in: path
   *         name: confirmationId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Confirmation
   *   post:
   *     tags: [Confirmations]
   *     summary: Decide a confirmation (approve/reject)
   *     parameters:
   *       - in: path
   *         name: confirmationId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               decision:
   *                 type: string
   *                 enum: [approved, rejected]
   *             required: [decision]
   *     responses:
   *       200:
   *         description: Updated confirmation
   */
  router.get('/confirmations/:confirmationId', controllers.confirmations.get.bind(controllers.confirmations));
  router.post('/confirmations/:confirmationId', controllers.confirmations.decide.bind(controllers.confirmations));

  /**
   * @swagger
   * /api/telemetry/preference:
   *   get:
   *     tags: [Telemetry]
   *     summary: Get telemetry opt-in preference
   *     responses:
   *       200:
   *         description: Preference
   *   put:
   *     tags: [Telemetry]
   *     summary: Set telemetry opt-in preference
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               isOptedIn: { type: boolean }
   *             required: [isOptedIn]
   *     responses:
   *       200:
   *         description: Preference updated
   */
  router.get('/telemetry/preference', controllers.telemetry.getPreference.bind(controllers.telemetry));
  router.put('/telemetry/preference', controllers.telemetry.setPreference.bind(controllers.telemetry));

  return router;
}

module.exports = {
  createApiRouter,
};
