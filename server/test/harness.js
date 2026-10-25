import request from 'supertest';
import session from 'express-session';
import { testDatabase, testEnv } from './database.js';
import { createApp } from '../src/app.js';
import { ensureIndexes, MysterySolution } from '../src/models/index.js';
import { claimJob } from '../src/jobs/queue.js';
import { runJob } from '../src/services/generation/pipeline.js';
import { MockGeminiProvider } from './fixtures/case.js';
import { MockImageProvider, MemoryStorageProvider } from './fixtures/assets.js';
import { assetGenerator } from '../src/services/assets/assets.service.js';
export async function investigationHarness() {
  const db = await testDatabase();
  await ensureIndexes();
  const env = { ...testEnv, MONGODB_URI: db.uri },
    storage = new MemoryStorageProvider(),
    app = createApp(env, { sessionStore: new session.MemoryStore(), storage, rateLimits: false });
  async function account(email) {
    const agent = request.agent(app),
      initial = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken,
      response = await agent
        .post('/api/v1/auth/register')
        .set('X-CSRF-Token', initial)
        .send({ name: 'Detective Ada', email, password: 'test-password-42' });
    if (response.status !== 201) throw new Error(`Test registration failed: ${response.status}`);
    const token = response.body.data.csrfToken;
    return {
      agent,
      user: response.body.data.user,
      send: (method, path, body) =>
        agent[method](`/api/v1${path}`).set('X-CSRF-Token', token).send(body),
    };
  }
  const owner = await account('owner@example.test'),
    foreign = await account('foreign@example.test');
  const created = await owner
    .send('post', '/mysteries', {
      scenario: 'A sculpture vanishes during a private gallery exhibition.',
      difficulty: 'easy',
      mysteryType: 'theft',
      suspectCount: 3,
    })
    .set('Idempotency-Key', 'harness-key-0001');
  if (created.status !== 202) throw new Error(`Test creation failed: ${created.status}`);
  const job = await claimJob('harness-worker');
  if (
    !(await runJob(job, {
      env,
      provider: new MockGeminiProvider(),
      generateAssets: assetGenerator(env, new MockImageProvider(), storage),
    }))
  )
    throw new Error('Mocked test generation failed');
  const id = created.body.data.mysteryId,
    solution = await MysterySolution.findOne({ mysteryId: id });
  return {
    db,
    app,
    env,
    storage,
    owner,
    foreign,
    id,
    jobId: created.body.data.jobId,
    solution,
    base: `/mysteries/${id}`,
    close: () => db.close(),
  };
}
