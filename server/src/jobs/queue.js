import { GenerationJob, User, Mystery } from '../models/index.js';
import { ACTIVE_JOB_STATES } from '../../../shared/constants/index.js';
export const LEASE_MS = 300000;
export async function reclaimExpiredJobs() {
  const staleUsers = await User.find({
    activeGenerationId: { $ne: null },
    generationReservedAt: { $lt: new Date(Date.now() - LEASE_MS) },
  })
    .select('activeGenerationId')
    .limit(100);
  for (const user of staleUsers) {
    const job = await GenerationJob.findById(user.activeGenerationId).select('status');
    if (job && ACTIVE_JOB_STATES.includes(job.status)) continue;
    await User.updateOne(
      { _id: user._id, activeGenerationId: user.activeGenerationId },
      { $unset: { activeGenerationId: 1, generationReservedAt: 1 } },
    );
    if (!job)
      await Mystery.updateMany(
        {
          ownerId: user._id,
          jobId: user.activeGenerationId,
          status: { $in: ['generating', 'validating'] },
        },
        { $set: { status: 'failed' } },
      );
  }
  return GenerationJob.updateMany(
    {
      status: { $in: ACTIVE_JOB_STATES.filter((s) => s !== 'queued') },
      lockedUntil: { $lt: new Date() },
    },
    {
      $set: { status: 'queued', currentStage: 'Resuming after worker restart' },
      $unset: { lockedBy: 1, lockedUntil: 1 },
    },
  );
}
export async function claimJob(workerId, jobId) {
  await reclaimExpiredJobs();
  return GenerationJob.findOneAndUpdate(
    { status: 'queued', ...(jobId ? { _id: jobId } : {}) },
    {
      $set: {
        status: 'planning',
        currentStage: 'Planning the truth',
        lockedBy: workerId,
        lockedUntil: new Date(Date.now() + LEASE_MS),
      },
      $min: { startedAt: new Date() },
    },
    { new: true, sort: { createdAt: 1 } },
  );
}
export async function renewLease(jobId, workerId) {
  return GenerationJob.updateOne(
    { _id: jobId, lockedBy: workerId, status: { $in: ACTIVE_JOB_STATES } },
    { $set: { lockedUntil: new Date(Date.now() + LEASE_MS) } },
  );
}
