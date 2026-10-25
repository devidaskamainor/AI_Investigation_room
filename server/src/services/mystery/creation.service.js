import mongoose from 'mongoose';
import { Mystery, GenerationJob, InvestigationProgress, User } from '../../models/index.js';
import { AppError, missing } from '../../middleware/errors.js';
import { mysteryDto, jobDto } from './dto.js';
import { listSchema } from '../../../../shared/schemas/index.js';
export function screenScenario(scenario) {
  if (
    /\b(?:self[- ]harm|suicide|sexual|pornograph\w*|gore|dismember\w*|graphic violence|real[- ]life (?:person|people))\b/i.test(
      scenario,
    )
  )
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Please use a fictional, age-appropriate scenario without real people or graphic content.',
    );
}
export async function getJob(userId, jobId) {
  const job = await GenerationJob.findOne({ _id: jobId, ownerId: userId });
  if (!job) throw missing();
  return jobDto(job);
}
export async function createMystery(
  userId,
  input,
  key,
  env,
  { initialStatus = 'queued', lockedBy } = {},
) {
  screenScenario(input.scenario);
  if (!key || !/^[\w-]{8,128}$/.test(key))
    throw new AppError(400, 'VALIDATION_ERROR', 'Provide a valid Idempotency-Key header.');
  const existing = await GenerationJob.findOne({ ownerId: userId, idempotencyKey: key });
  if (existing)
    return {
      mysteryId: String(existing.mysteryId),
      jobId: String(existing._id),
      status: existing.status,
    };
  const jobId = new mongoose.Types.ObjectId(),
    mysteryId = new mongoose.Types.ObjectId(),
    today = new Date().toISOString().slice(0, 10);
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      activeGenerationId: null,
      $or: [
        { generationDay: { $ne: today } },
        { generationCount: { $lt: env.DAILY_GENERATION_LIMIT } },
      ],
    },
    [
      {
        $set: {
          activeGenerationId: jobId,
          generationReservedAt: new Date(),
          generationDay: today,
          generationCount: {
            $cond: [
              { $eq: ['$generationDay', today] },
              { $add: [{ $ifNull: ['$generationCount', 0] }, 1] },
              1,
            ],
          },
        },
      },
    ],
    { new: true },
  );
  if (!user) {
    const current = await User.findById(userId);
    if (current?.activeGenerationId)
      throw new AppError(409, 'GENERATION_IN_PROGRESS', 'You already have a case generating.');
    throw new AppError(429, 'RATE_LIMIT_EXCEEDED', 'You have reached today’s generation limit.');
  }
  try {
    await Mystery.create({
      _id: mysteryId,
      ownerId: userId,
      title: input.title || 'An untitled mystery',
      originalScenario: input.scenario,
      mysteryType: input.mysteryType,
      difficulty: input.difficulty,
      requestedSuspectCount: input.suspectCount,
      status: 'generating',
      jobId,
    });
    await GenerationJob.create({
      _id: jobId,
      mysteryId,
      ownerId: userId,
      idempotencyKey: key,
      status: initialStatus,
      ...(lockedBy ? { lockedBy, lockedUntil: new Date(Date.now() + 300000) } : {}),
    });
    return { mysteryId: String(mysteryId), jobId: String(jobId), status: initialStatus };
  } catch (error) {
    await User.updateOne(
      { _id: userId, activeGenerationId: jobId },
      { $unset: { activeGenerationId: 1 }, $inc: { generationCount: -1 } },
    );
    await Mystery.deleteOne({ _id: mysteryId });
    throw error;
  }
}
export async function retryJob(userId, jobId) {
  const job = await GenerationJob.findOne({ _id: jobId, ownerId: userId });
  if (!job) throw missing();
  if (job.status !== 'failed' || job.attempts >= 3)
    throw new AppError(409, 'RETRY_UNAVAILABLE', 'This case cannot be retried again.');
  const user = await User.findOneAndUpdate(
    { _id: userId, activeGenerationId: null },
    { $set: { activeGenerationId: job._id, generationReservedAt: new Date() } },
  );
  if (!user)
    throw new AppError(409, 'GENERATION_IN_PROGRESS', 'You already have a case generating.');
  try {
    const updated = await GenerationJob.findOneAndUpdate(
      { _id: jobId, status: 'failed', attempts: job.attempts },
      {
        $set: { status: 'queued', currentStage: 'Queued', progressPercentage: 0, repairCycles: 0 },
        $unset: { lockedBy: 1, lockedUntil: 1, errorCode: 1, safeErrorMessage: 1, completedAt: 1 },
        $inc: { attempts: 1 },
      },
      { new: true },
    );
    if (!updated) throw new AppError(409, 'RETRY_UNAVAILABLE', 'A retry is already running.');
    await Mystery.updateOne(
      { _id: job.mysteryId, ownerId: userId, status: 'failed' },
      { $set: { status: 'generating' } },
    );
    return { mysteryId: String(job.mysteryId), jobId: String(job._id), status: 'queued' };
  } catch (e) {
    await User.updateOne(
      { _id: userId, activeGenerationId: job._id },
      { $unset: { activeGenerationId: 1 } },
    );
    throw e;
  }
}
export async function listMysteries(userId, query) {
  const { page, limit, status } = listSchema.parse(query),
    filter = { ownerId: userId };
  const completed = await InvestigationProgress.find({ userId, status: 'completed' })
    .select('mysteryId result')
    .lean();
  const completedIds = completed.map((p) => p.mysteryId);
  if (status === 'completed') filter._id = { $in: completedIds };
  else if (status === 'in_progress') {
    filter._id = { $nin: completedIds };
    filter.status = { $ne: 'archived' };
  } else if (status) filter.status = status;
  const [records, total] = await Promise.all([
    Mystery.find(filter)
      .select(
        'title difficulty mysteryType status premise incident motiveOptions suspectIds evidenceIds requestedSuspectCount jobId createdAt isDemo',
      )
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Mystery.countDocuments(filter),
  ]);
  const jobs = await GenerationJob.find({ _id: { $in: records.map((m) => m.jobId) } })
    .select('progressPercentage')
    .lean();
  return {
    items: records.map((m) => ({
      ...mysteryDto(m),
      progressPercentage:
        jobs.find((j) => String(j._id) === String(m.jobId))?.progressPercentage || 0,
      outcome: completed.find((p) => String(p.mysteryId) === String(m._id))?.result?.rank || null,
    })),
    total,
    page,
    limit,
  };
}
