import mongoose from 'mongoose';
import { readEnv } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { logger } from './config/logger.js';
import { randomUUID } from 'node:crypto';
import { ensureIndexes, GenerationJob, MysterySolution } from './models/index.js';
import { claimJob, renewLease } from './jobs/queue.js';
import { runJob } from './services/generation/pipeline.js';
import { GeminiProvider } from './services/ai/gemini.provider.js';
import { imageProvider } from './services/ai/image.provider.js';
import { storageProvider } from './services/assets/storage.provider.js';
import { assetGenerator, cleanupMystery } from './services/assets/assets.service.js';
try {
  const env = readEnv();
  await connectDatabase(env.MONGODB_URI);
  await ensureIndexes();
  const workerId = randomUUID(),
    storage = storageProvider(env),
    images = imageProvider(env);
  let stopping = false,
    currentJob;
  logger.info({ workerId }, 'Worker connected');
  const heartbeat = setInterval(async () => {
    try {
      if (currentJob) await renewLease(currentJob._id, workerId);
      logger.info(
        {
          workerId,
          jobId: currentJob ? String(currentJob._id) : null,
          stage: currentJob ? 'working' : 'idle',
        },
        'Worker heartbeat',
      );
    } catch {
      logger.warn({ workerId, code: 'HEARTBEAT_FAILED' }, 'Worker heartbeat failed');
    }
  }, 20000);
  const stop = () => {
    stopping = true;
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  while (!stopping) {
    try {
      currentJob = await claimJob(workerId);
      if (currentJob) {
        const provider = new GeminiProvider(env, {
          onUsage: async (stage, tokens) => {
            await MysterySolution.updateOne(
              { mysteryId: currentJob.mysteryId, frozenAt: null },
              { $push: { 'generationMeta.tokenUsage': { stage, tokens } } },
            );
          },
          onRetry: async () => {
            await GenerationJob.updateOne(
              { _id: currentJob._id },
              { $inc: { providerRetries: 1, providerErrors: 1 } },
            );
          },
        });
        await runJob(currentJob, {
          env,
          provider,
          generateAssets: assetGenerator(env, images, storage),
          cleanupOrphans: (id) => cleanupMystery(id, storage),
          shouldStop: () => stopping,
        });
        currentJob = null;
      } else await new Promise((r) => setTimeout(r, 1000));
    } catch {
      logger.warn({ workerId, code: 'WORKER_LOOP_ERROR' }, 'Worker operation failed');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  clearInterval(heartbeat);
  await mongoose.disconnect();
} catch (err) {
  logger.error({
    message: err.message.startsWith('Configuration error')
      ? err.message
      : 'Worker database connection failed.',
  });
  process.exit(1);
}
