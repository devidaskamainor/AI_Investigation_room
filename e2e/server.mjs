// Test-only API + worker. Never used by npm start or production.
import { createServer } from 'node:http';
import session from 'express-session';
import { testDatabase, testEnv } from '../server/test/database.js';
import { createApp } from '../server/src/app.js';
import { ensureIndexes, Mystery } from '../server/src/models/index.js';
import { claimJob, renewLease } from '../server/src/jobs/queue.js';
import { runJob } from '../server/src/services/generation/pipeline.js';
import { assetGenerator } from '../server/src/services/assets/assets.service.js';
import { MockGeminiProvider, caseFixture } from '../server/test/fixtures/case.js';
import { MockImageProvider, MemoryStorageProvider } from '../server/test/fixtures/assets.js';
const db = await testDatabase();
await ensureIndexes();
const env = { ...testEnv, MONGODB_URI: db.uri, PORT: 5011, CLIENT_URL: 'http://127.0.0.1:5174' },
  storage = new MemoryStorageProvider(),
  server = createServer(
    createApp(env, { sessionStore: new session.MemoryStore(), storage, rateLimits: false }),
  );
await new Promise((resolve) => server.listen(5011, '127.0.0.1', resolve));
let busy = false,
  stopping = false,
  active;
const timer = setInterval(async () => {
  if (busy || stopping) return;
  busy = true;
  try {
    active = await claimJob('playwright-test-worker');
    if (active) {
      const m = await Mystery.findById(active.mysteryId);
      await runJob(active, {
        env,
        provider: new MockGeminiProvider(
          caseFixture({ difficulty: m.difficulty, suspectCount: m.requestedSuspectCount }),
        ),
        generateAssets: assetGenerator(env, new MockImageProvider(), storage),
      });
      active = null;
    }
  } finally {
    busy = false;
  }
}, 150);
const heartbeat = setInterval(async () => {
  if (active) await renewLease(active._id, 'playwright-test-worker');
}, 20000);
async function stop() {
  stopping = true;
  clearInterval(timer);
  clearInterval(heartbeat);
  server.close();
  while (busy) await new Promise((resolve) => setTimeout(resolve, 50));
  await db.close();
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
console.info('Isolated test API listening on 5011');
