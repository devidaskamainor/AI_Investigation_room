import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { testDatabase, testEnv } from '../../../test/database.js';
import { createApp } from '../../app.js';
import { User, Mystery, ensureIndexes } from '../../models/index.js';
import { ownedMystery } from '../../middleware/security.js';
import {
  scanPublic,
  mysteryDto,
  suspectDto,
  evidenceDto,
  jobDto,
  progressDto,
} from '../mystery/dto.js';
describe('M2 accounts and public/private boundary', () => {
  let db, app, agent, csrf, resetUrl;
  beforeAll(async () => {
    db = await testDatabase();
    await ensureIndexes();
    app = createApp(
      { ...testEnv, MONGODB_URI: db.uri },
      {
        rateLimits: false,
        emailProvider: {
          async sendReset(_email, url) {
            resetUrl = url;
          },
        },
      },
    );
    agent = request.agent(app);
    csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
  });
  afterAll(async () => {
    await db.close();
  });
  it('FR-01 registers normalized email and bcrypt cost 12; session survives a request', async () => {
    const response = await agent
      .post('/api/v1/auth/register')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Ada', email: 'ADA@example.test', password: 'correct-horse-42' });
    expect(response.status).toBe(201);
    csrf = response.body.data.csrfToken;
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect((await agent.get('/api/v1/auth/me')).body.data.user.email).toBe('ada@example.test');
    const user = await User.findOne({ email: 'ada@example.test' }).select('+passwordHash');
    expect(bcrypt.getRounds(user.passwordHash)).toBe(12);
    expect(await bcrypt.compare('correct-horse-42', user.passwordHash)).toBe(true);
    expect(scanPublic(response.body)).toEqual([]);
  });
  it('FR-04 denies unauthenticated profile and missing/foreign CSRF tokens', async () => {
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(401);
    expect((await agent.post('/api/v1/auth/logout')).status).toBe(403);
    expect(
      (
        await agent
          .post('/api/v1/auth/logout')
          .set('X-CSRF-Token', csrf)
          .set('Origin', 'https://attacker.test')
      ).status,
    ).toBe(403);
  });
  it('FR-03 reset is hashed, single use and private', async () => {
    const unknown = await agent
      .post('/api/v1/auth/forgot-password')
      .set('X-CSRF-Token', csrf)
      .send({ email: 'missing@example.test' });
    const known = await agent
      .post('/api/v1/auth/forgot-password')
      .set('X-CSRF-Token', csrf)
      .send({ email: 'ada@example.test' });
    expect(known.body).toEqual(unknown.body);
    const token = new URL(resetUrl).searchParams.get('token');
    const user = await User.findOne({ email: 'ada@example.test' }).select('+resetTokenHash');
    expect(user.resetTokenHash).not.toBe(token);
    const body = { token, password: 'new-password-42' };
    expect(
      (await agent.post('/api/v1/auth/reset-password').set('X-CSRF-Token', csrf).send(body)).status,
    ).toBe(200);
    expect(
      (await agent.post('/api/v1/auth/reset-password').set('X-CSRF-Token', csrf).send(body)).status,
    ).toBe(400);
  });
  it('FR-02 logs out and logs back in; wrong credentials stay generic', async () => {
    expect((await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', csrf)).status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
    const a = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: 'missing@example.test', password: 'bad-password' });
    const b = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: 'ada@example.test', password: 'bad-password' });
    expect(a.body).toEqual(b.body);
    const login = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: 'ada@example.test', password: 'new-password-42' });
    expect(login.status).toBe(200);
    csrf = login.body.data.csrfToken;
  });
  it('FR-04 ownership hides foreign records and validates IDs', async () => {
    const user = await User.findOne({ email: 'ada@example.test' });
    const mystery = await Mystery.create({
      ownerId: user._id,
      title: 'Private case',
      status: 'generating',
    });
    await expect(
      ownedMystery(String(new mongoose.Types.ObjectId()), String(mystery._id)),
    ).rejects.toMatchObject({ status: 404 });
    await expect(ownedMystery(String(user._id), String(mystery._id), true)).rejects.toMatchObject({
      code: 'MYSTERY_NOT_READY',
    });
    await expect(ownedMystery(String(user._id), 'invalid')).rejects.toThrow();
  });
  it('AC-09 allowlist DTOs drop unknown and private nested fields', () => {
    const id = new mongoose.Types.ObjectId();
    const poisoned = {
      _id: id,
      culpritSuspectId: id,
      facts: ['secret'],
      solutionId: id,
      generationMeta: { checkpoints: 'secret' },
      hints: ['secret'],
      suspectIds: [id],
      evidenceIds: [],
      relatedSuspectIds: [],
      assetIds: [],
      category: 'document',
      source: { label: 'Archive', facts: ['secret'] },
      content: { docType: 'memo', author: 'A', body: 'Published clue', facts: ['secret'] },
    };
    for (const mapper of [mysteryDto, suspectDto, (v) => evidenceDto(v, true), jobDto])
      expect(scanPublic(mapper(poisoned))).toEqual([]);
    expect(
      scanPublic(
        progressDto({
          status: 'in_progress',
          viewedEvidenceIds: [],
          pins: [],
          notes: [],
          accusations: [{ suspectId: id }],
          hintsUsed: 0,
          ...poisoned,
        }),
      ),
    ).toEqual([]);
    expect(scanPublic({ nested: [{ facts: [] }] })).toEqual(['facts']);
  });
  it('FR-11 malformed bodies use the standard safe envelope', async () => {
    const r = await agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', csrf)
      .send({ email: 'not-an-email', password: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect(r.body.error.details.length).toBeGreaterThan(0);
  });
  it('AC-10 unauthenticated asset requests are not served as static files', async () => {
    expect((await request(app).get('/storage/private.png')).status).toBe(404);
  });
});
