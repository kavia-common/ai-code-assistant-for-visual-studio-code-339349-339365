'use strict';

const request = require('supertest');
const app = require('../app');

describe('API integration', () => {
  test('GET / health ok', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('PUT/GET /api/settings/:key roundtrip', async () => {
    const putRes = await request(app)
      .put('/api/settings/test_key')
      .send({ value: { a: 1, b: 'x' } })
      .set('content-type', 'application/json');
    expect(putRes.status).toBe(200);
    expect(putRes.body.key).toBe('test_key');
    expect(putRes.body.value).toEqual({ a: 1, b: 'x' });

    const getRes = await request(app).get('/api/settings/test_key');
    expect(getRes.status).toBe(200);
    expect(getRes.body.value).toEqual({ a: 1, b: 'x' });
  });

  test('Chat session create + send message (local stub)', async () => {
    const sRes = await request(app)
      .post('/api/chat/sessions')
      .send({ title: 't1' })
      .set('content-type', 'application/json');
    expect(sRes.status).toBe(201);
    expect(sRes.body.id).toBeTruthy();

    const sessionId = sRes.body.id;

    const msgRes = await request(app)
      .post(`/api/chat/sessions/${sessionId}/messages`)
      .send({ content: 'hello' })
      .set('content-type', 'application/json');
    expect(msgRes.status).toBe(200);
    expect(msgRes.body.session.id).toBe(sessionId);
    expect(Array.isArray(msgRes.body.messagesAppended)).toBe(true);
    expect(msgRes.body.messagesAppended.some((m) => m.role === 'assistant')).toBe(true);
  });

  test('Chat tool call path (echo)', async () => {
    const sRes = await request(app).post('/api/chat/sessions').send({ title: 'tools' });
    const sessionId = sRes.body.id;

    const msgRes = await request(app)
      .post(`/api/chat/sessions/${sessionId}/messages`)
      .send({ content: 'use tool:echo hello world' })
      .set('content-type', 'application/json');

    expect(msgRes.status).toBe(200);
    expect(msgRes.body.toolResults.length).toBe(1);
    expect(msgRes.body.toolResults[0].name).toBe('echo');
  });
});
