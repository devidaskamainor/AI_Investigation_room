import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import session from 'express-session';
import { createApp } from '../app.js';
import { isAllowedOrigin } from './security.js';
import { testDatabase, testEnv } from '../../test/database.js';
import { ensureIndexes } from '../models/index.js';

describe('Development origins and CSRF protection', () => {
  let db, app;
  const env = { ...testEnv, NODE_ENV: 'development', CLIENT_URL: 'http://localhost:5173' };
  beforeAll(async () => {
    db = await testDatabase();
    await ensureIndexes();
    app = createApp(
      { ...env, MONGODB_URI: db.uri },
      {
        sessionStore: new session.MemoryStore(),
        rateLimits: false,
      },
    );
  });
  afterAll(async () => {
    await db?.close();
  });

  it.each(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'])(
    'allows the local address %s with a valid token',
    async (origin) => {
      const agent = request.agent(app);
      const initial = await agent.get('/api/v1/auth/csrf').set('Origin', origin);
      expect(initial.headers['access-control-allow-origin']).toBe(origin);
      const response = await agent
        .post('/api/v1/auth/forgot-password')
        .set('Origin', origin)
        .set('X-CSRF-Token', initial.body.data.csrfToken)
        .send({ email: 'unknown@example.test' });
      expect(response.status).toBe(200);
    },
  );
  it.each([
    'http://localhost:5174',
    'https://localhost:5173',
    'http://localhost.attacker.test:5173',
    'https://attacker.test',
    'null',
  ])('rejects the unrelated origin %s', async (origin) => {
    const agent = request.agent(app);
    const initial = await agent.get('/api/v1/auth/csrf');
    const response = await agent
      .post('/api/v1/auth/forgot-password')
      .set('Origin', origin)
      .set('X-CSRF-Token', initial.body.data.csrfToken)
      .send({ email: 'unknown@example.test' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
  it('still rejects missing, forged and multibyte tokens from an allowed origin', async () => {
    const agent = request.agent(app);
    await agent.get('/api/v1/auth/csrf');
    for (const token of ['', '0'.repeat(64), 'é'.repeat(64)]) {
      const response = await agent
        .post('/api/v1/auth/forgot-password')
        .set('Origin', 'http://127.0.0.1:5173')
        .set('X-CSRF-Token', token)
        .send({ email: 'unknown@example.test' });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CSRF_ERROR');
    }
  });
  it('requires the exact configured origin outside development', () => {
    const production = { ...env, NODE_ENV: 'production', CLIENT_URL: 'https://localhost:5173' };
    expect(isAllowedOrigin('https://localhost:5173', production)).toBe(true);
    expect(isAllowedOrigin('https://127.0.0.1:5173', production)).toBe(false);
    expect(isAllowedOrigin('https://[::1]:5173', production)).toBe(false);
    expect(isAllowedOrigin('https://localhost:5173/path', production)).toBe(false);
  });
});
