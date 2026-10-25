import mongoose from 'mongoose';
import {
  DIFFICULTIES,
  MYSTERY_TYPES,
  CATEGORIES,
  JOB_STATES,
  ACTIVE_JOB_STATES,
} from '../../../shared/constants/index.js';
const { Schema } = mongoose;
const oid = (ref, required = true) => ({ type: Schema.Types.ObjectId, ref, required });
const options = { timestamps: true, strict: 'throw' };
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, lowercase: true, unique: true, required: true },
    passwordHash: { type: String, required: true, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpiresAt: Date,
    activeGenerationId: oid('GenerationJob', false),
    generationReservedAt: Date,
    generationDay: String,
    generationCount: { type: Number, default: 0 },
  },
  options,
);
const mysterySchema = new Schema(
  {
    ownerId: oid('User'),
    title: String,
    originalScenario: String,
    mysteryType: { type: String, enum: MYSTERY_TYPES },
    difficulty: { type: String, enum: DIFFICULTIES },
    requestedSuspectCount: Number,
    status: {
      type: String,
      enum: ['draft', 'generating', 'validating', 'ready', 'failed', 'archived'],
      default: 'draft',
    },
    premise: String,
    incident: { summary: String, location: String, whenLabel: String },
    motiveOptions: [{ _id: false, id: String, text: String }],
    suspectIds: [oid('Suspect')],
    evidenceIds: [oid('Evidence')],
    solutionId: oid('MysterySolution', false),
    jobId: oid('GenerationJob', false),
    publishedAt: Date,
    isDemo: { type: Boolean, default: false },
  },
  options,
);
mysterySchema.index({ ownerId: 1, createdAt: -1 });
const suspectSchema = new Schema(
  {
    mysteryId: oid('Mystery'),
    name: String,
    age: Number,
    occupation: String,
    background: String,
    relationshipToIncident: String,
    publicMotive: String,
    alibi: String,
    initialStatement: String,
    portraitAssetId: oid('Asset', false),
  },
  options,
);
suspectSchema.index({ mysteryId: 1 });
const evidenceSchema = new Schema(
  {
    mysteryId: oid('Mystery'),
    category: { type: String, enum: CATEGORIES },
    title: String,
    description: String,
    source: { label: String },
    occurredAt: Date,
    relatedSuspectIds: [oid('Suspect')],
    assetIds: [oid('Asset')],
    isReconstruction: Boolean,
    content: Schema.Types.Mixed,
  },
  options,
);
evidenceSchema.index({ mysteryId: 1, category: 1 });
const solutionSchema = new Schema(
  {
    mysteryId: { ...oid('Mystery'), unique: true },
    culpritSuspectId: oid('Suspect', false),
    correctMotiveOptionId: String,
    motive: String,
    method: String,
    opportunity: String,
    canonicalTimeline: [Schema.Types.Mixed],
    facts: [Schema.Types.Mixed],
    claims: [Schema.Types.Mixed],
    evidenceMap: [Schema.Types.Mixed],
    keyEvidenceIds: [oid('Evidence')],
    contradictionEvidenceIds: [oid('Evidence')],
    redHerrings: [Schema.Types.Mixed],
    hints: [String],
    nudge: String,
    explanation: String,
    generationMeta: Schema.Types.Mixed,
    frozenAt: Date,
  },
  options,
);
const note = new Schema({ text: String }, { timestamps: true });
const progressSchema = new Schema(
  {
    userId: oid('User'),
    mysteryId: oid('Mystery'),
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started',
    },
    viewedEvidenceIds: [oid('Evidence')],
    pins: [{ _id: false, evidenceId: oid('Evidence'), label: String }],
    notes: [note],
    hintsUsed: { type: Number, default: 0 },
    accusations: [
      {
        _id: false,
        suspectId: oid('Suspect'),
        motiveOptionId: String,
        evidenceIds: [oid('Evidence')],
        correct: Boolean,
        at: Date,
      },
    ],
    result: { score: Number, rank: String, completedAt: Date },
    startedAt: Date,
    lastActivityAt: Date,
  },
  { ...options, optimisticConcurrency: true },
);
progressSchema.index({ userId: 1, mysteryId: 1 }, { unique: true });
const jobSchema = new Schema(
  {
    mysteryId: oid('Mystery'),
    ownerId: oid('User'),
    idempotencyKey: String,
    status: { type: String, enum: JOB_STATES, default: 'queued' },
    currentStage: { type: String, default: 'Queued' },
    progressPercentage: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    repairCycles: { type: Number, default: 0 },
    lockedBy: String,
    lockedUntil: Date,
    errorCode: String,
    safeErrorMessage: String,
    startedAt: Date,
    completedAt: Date,
    durationMs: Number,
    providerErrors: { type: Number, default: 0 },
    providerRetries: { type: Number, default: 0 },
    validationFailures: { type: Number, default: 0 },
    solverFailures: { type: Number, default: 0 },
  },
  options,
);
jobSchema.index({ ownerId: 1, createdAt: -1 });
jobSchema.index({ status: 1, lockedUntil: 1 });
jobSchema.index({ ownerId: 1, idempotencyKey: 1 }, { unique: true });
jobSchema.index(
  { ownerId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_JOB_STATES } } },
);
const assetSchema = new Schema(
  {
    mysteryId: oid('Mystery'),
    type: {
      type: String,
      enum: ['suspect_portrait', 'scene_image', 'cctv_frame', 'document_image', 'other'],
    },
    storageKey: { type: String, required: true },
    mimeType: String,
    sizeBytes: Number,
    generationStatus: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending' },
    label: { type: String, default: 'AI-generated fiction' },
    metadata: Schema.Types.Mixed,
  },
  options,
);
assetSchema.index({ mysteryId: 1 });
assetSchema.index({ storageKey: 1 }, { unique: true });
export const User = mongoose.model('User', userSchema);
export const Mystery = mongoose.model('Mystery', mysterySchema);
export const Suspect = mongoose.model('Suspect', suspectSchema);
export const Evidence = mongoose.model('Evidence', evidenceSchema);
export const MysterySolution = mongoose.model('MysterySolution', solutionSchema);
export const InvestigationProgress = mongoose.model(
  'InvestigationProgress',
  progressSchema,
  'investigationprogress',
);
export const GenerationJob = mongoose.model('GenerationJob', jobSchema);
export const Asset = mongoose.model('Asset', assetSchema);
export async function ensureIndexes() {
  await Promise.all(
    [
      User,
      Mystery,
      Suspect,
      Evidence,
      MysterySolution,
      InvestigationProgress,
      GenerationJob,
      Asset,
    ].map((m) => m.init()),
  );
}
