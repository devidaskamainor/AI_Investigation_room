export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const MYSTERY_TYPES = [
  'theft',
  'disappearance',
  'murder',
  'corporate_espionage',
  'missing_artifact',
  'general',
  'open_ended',
];
export const CATEGORIES = [
  'message',
  'image',
  'cctv',
  'document',
  'witness_statement',
  'timeline',
  'other',
];
export const PROFILES = {
  easy: { suspects: 3, min: 8, max: 10, keys: 2, herrings: 1 },
  medium: { suspects: 4, min: 10, max: 12, keys: 3, herrings: 2 },
  hard: { suspects: 5, min: 12, max: 15, keys: 4, herrings: 3 },
};
export const JOB_STATES = [
  'queued',
  'planning',
  'generating_suspects',
  'generating_evidence',
  'generating_assets',
  'validating',
  'repairing',
  'publishing',
  'completed',
  'failed',
];
export const ACTIVE_JOB_STATES = JOB_STATES.filter((s) => !['completed', 'failed'].includes(s));
