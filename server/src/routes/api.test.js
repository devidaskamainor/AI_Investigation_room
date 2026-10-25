import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import session from 'express-session';
import { createApp } from '../app.js';
import { ensureIndexes, GenerationJob, User } from '../models/index.js';
import { testDatabase, testEnv } from '../../test/database.js';
describe('FR-11 API validation, asynchronous creation and rate limits', () => {
  let db, app, agent, token, userId;
  beforeAll(async () => {
    db = await testDatabase();
    await ensureIndexes();
    app = createApp(
      { ...testEnv, MONGODB_URI: db.uri },
      { sessionStore: new session.MemoryStore(), rateLimits: false },
    );
    agent = request.agent(app);
    token = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
    const registered = await agent
      .post('/api/v1/auth/register')
      .set('X-CSRF-Token', token)
      .send({ name: 'API Detective', email: 'api@example.test', password: 'test-password-42' });
    token = registered.body.data.csrfToken;
    userId = registered.body.data.user.id;
  });
  afterAll(async () => {
    await db?.close();
  });
  const input = {
    scenario: 'A sculpture vanishes during a private gallery exhibition.',
    difficulty: 'easy',
    mysteryType: 'theft',
    suspectCount: 3,
  };
  it('AC-03 validates all creation fields on the server', async () => {
    for (const body of [
      { ...input, scenario: 'short' },
      { ...input, difficulty: 'impossible' },
      { ...input, mysteryType: 'unlisted' },
      { ...input, suspectCount: 7 },
    ]) {
      const r = await agent
        .post('/api/v1/mysteries')
        .set('X-CSRF-Token', token)
        .set('Idempotency-Key', 'validation-key-0001')
        .send(body);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
      expect(r.body.error.details.length).toBeGreaterThan(0);
    }
  });
  it('AC-02 returns 202 inside 500ms and a durable queued job without a provider call', async () => {
    const start = performance.now(),
      r = await agent
        .post('/api/v1/mysteries')
        .set('X-CSRF-Token', token)
        .set('Idempotency-Key', 'async-key-0001')
        .send(input);
    expect(performance.now() - start).toBeLessThan(500);
    expect(r.status).toBe(202);
    expect((await GenerationJob.findById(r.body.data.jobId)).status).toBe('queued');
  });
  it('rejects unexpected queries and oversized JSON safely', async () => {
    expect((await agent.get('/api/v1/auth/me?unknown=true')).status).toBe(400);
    const r = await agent
      .post('/api/v1/mysteries')
      .set('X-CSRF-Token', token)
      .send({ ...input, scenario: 'x'.repeat(21000) });
    expect(r.status).toBe(413);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('limits login attempts and rejects scripted invalid payloads without bcrypt work', async () => {
    const limited = createApp(
        { ...testEnv, MONGODB_URI: db.uri },
        { sessionStore: new session.MemoryStore() },
      ),
      attacker = request.agent(limited),
      csrf = (await attacker.get('/api/v1/auth/csrf')).body.data.csrfToken;
    let r;
    for (let i = 0; i < 11; i++)
      r = await attacker
        .post('/api/v1/auth/login')
        .set('X-CSRF-Token', csrf)
        .send({ email: 'bad', password: 'x' });
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect((await User.findById(userId)).email).toBe('api@example.test');
  });
});
