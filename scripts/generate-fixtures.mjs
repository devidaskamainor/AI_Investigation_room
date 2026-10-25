import { writeFile, readFile, rename } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { readEnv } from '../server/src/config/env.js';
import { connectDatabase } from '../server/src/config/db.js';
import {
  ensureIndexes,
  User,
  Mystery,
  MysterySolution,
  GenerationJob,
  Asset,
} from '../server/src/models/index.js';
import { claimJob, renewLease } from '../server/src/jobs/queue.js';
import { runJob } from '../server/src/services/generation/pipeline.js';
import { GeminiProvider } from '../server/src/services/ai/gemini.provider.js';
import { imageProvider } from '../server/src/services/ai/image.provider.js';
import { storageProvider } from '../server/src/services/assets/storage.provider.js';
import { assetGenerator } from '../server/src/services/assets/assets.service.js';
import { createMystery } from '../server/src/services/mystery/creation.service.js';
const root = new URL('../fixtures/demo-cases/', import.meta.url);
let heartbeat;
try {
  const env = readEnv();
  if (!env.SOLVER_CHECK_ENABLED)
    throw new Error('Enable SOLVER_CHECK_ENABLED to generate trustworthy showcase fixtures.');
  await connectDatabase(env.MONGODB_URI);
  await ensureIndexes();
  let user = await User.findOne({ email: 'showcase-generator@local.invalid' });
  if (!user)
    user = await User.create({
      name: 'Showcase Generator',
      email: 'showcase-generator@local.invalid',
      passwordHash: await bcrypt.hash(randomBytes(40).toString('hex'), 12),
    });
  const storage = storageProvider(env),
    manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  for (const entry of manifest) {
    console.info(`Generating real ${entry.difficulty} showcase: ${entry.title}`);
    const created = await createMystery(String(user._id), entry, randomUUID(), env),
      workerId = `export-${randomUUID()}`,
      job = await claimJob(workerId, created.jobId);
    if (job) {
      heartbeat = setInterval(() => renewLease(job._id, workerId).catch(() => {}), 20000);
      const successful = await runJob(job, {
        env,
        provider: new GeminiProvider(env),
        generateAssets: assetGenerator(env, imageProvider(env), storage),
      });
      clearInterval(heartbeat);
      if (!successful) throw new Error(`Showcase generation failed: ${entry.slug}`);
    } else {
      let current;
      do {
        await new Promise((r) => setTimeout(r, 1000));
        current = await GenerationJob.findById(created.jobId);
      } while (current && !['completed', 'failed'].includes(current.status));
      if (current?.status !== 'completed')
        throw new Error(`Showcase generation failed: ${entry.slug}`);
    }
    const mystery = await Mystery.findById(created.mysteryId),
      solution = await MysterySolution.findOne({ mysteryId: mystery._id }),
      draft = solution.generationMeta.checkpoints,
      assets = [];
    for (const [key, id] of Object.entries(draft.assets)) {
      const a = await Asset.findById(id);
      assets.push({
        key,
        type: a.type,
        mimeType: a.mimeType,
        base64: (await storage.get(a.storageKey)).toString('base64'),
      });
    }
    const fixture = {
        version: 1,
        slug: entry.slug,
        provenance: {
          provider: 'gemini',
          model: env.GEMINI_MODEL,
          generatedAt: new Date().toISOString(),
          validator: true,
          blindSolver: true,
        },
        draft,
        assets,
      },
      path = new URL(`${entry.slug}.json`, root),
      temporary = new URL(`${entry.slug}.json.tmp`, root);
    await writeFile(temporary, JSON.stringify(fixture));
    await rename(temporary, path);
    console.info(`Saved validated showcase ${entry.slug}.json`);
  }
} catch (e) {
  console.error(
    e.message.startsWith('Configuration error') || e.message.startsWith('Enable SOLVER')
      ? e.message
      : 'Showcase generation did not complete. Review safe job status in MongoDB; no fixture was falsely marked ready.',
  );
  process.exitCode = 1;
} finally {
  clearInterval(heartbeat);
  await mongoose.disconnect();
}
