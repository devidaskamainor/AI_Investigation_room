import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { testDatabase, testEnv } from '../test/database.js';
import { createApp } from './app.js';
import session from 'express-session';
describe('M1 health', () => {
  let db;
  beforeAll(async () => {
    db = await testDatabase();
  });
  afterAll(async () => {
    await db?.close();
  });
  it('checks process and MongoDB', async () => {
    const response = await request(
      createApp({ ...testEnv, MONGODB_URI: db.uri }, { sessionStore: new session.MemoryStore() }),
    ).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.data.database).toBe('ok');
  });
});
