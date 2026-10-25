import mongoose from 'mongoose';
import { readDatabaseEnv } from '../server/src/config/env.js';
import { connectDatabase } from '../server/src/config/db.js';
import { GenerationJob, Asset, Mystery } from '../server/src/models/index.js';
try {
  const env = readDatabaseEnv();
  await connectDatabase(env.MONGODB_URI);
  const liveMysteryIds = await Mystery.distinct('_id', { isDemo: { $ne: true } });
  const jobs = await GenerationJob.find({ mysteryId: { $in: liveMysteryIds } })
      .select('status durationMs providerErrors providerRetries validationFailures solverFailures')
      .lean(),
    ended = jobs.filter((j) => ['completed', 'failed'].includes(j.status)),
    completed = ended.filter((j) => j.status === 'completed'),
    average = (values) =>
      values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const assets = await Asset.aggregate([
      { $match: { mysteryId: { $in: liveMysteryIds } } },
      { $group: { _id: '$generationStatus', count: { $sum: 1 } } },
    ]),
    cases = await Mystery.find({ _id: { $in: liveMysteryIds }, status: 'ready' })
      .select('evidenceIds')
      .lean();
  console.info(
    JSON.stringify(
      {
        totalJobs: jobs.length,
        finishedJobs: ended.length,
        generationSuccessRate: ended.length ? completed.length / ended.length : null,
        averageDurationMs: average(completed.map((j) => j.durationMs).filter(Number.isFinite)),
        averageRetries: ended.length
          ? ended.reduce((n, j) => n + (j.providerRetries || 0), 0) / ended.length
          : null,
        providerErrors: ended.reduce((n, j) => n + (j.providerErrors || 0), 0),
        validationFailures: ended.reduce((n, j) => n + (j.validationFailures || 0), 0),
        blindSolverFailures: ended.reduce((n, j) => n + (j.solverFailures || 0), 0),
        failedJobs: ended.length - completed.length,
        assets: Object.fromEntries(assets.map((a) => [a._id, a.count])),
        averageEvidencePerPublishedCase: average(cases.map((m) => m.evidenceIds.length)),
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(
    e.message.startsWith('Configuration error')
      ? e.message
      : 'Stats could not connect to the configured database.',
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
