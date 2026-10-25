import { MysterySolution, Suspect, Evidence, InvestigationProgress } from '../../models/index.js';
import { ownedMystery } from '../../middleware/security.js';
import { AppError, missing } from '../../middleware/errors.js';
import { changeProgress } from '../evidence/investigation.service.js';
import { scoreTheory } from './scoring.service.js';
export async function accuse(userId, mysteryId, theory) {
  const mystery = await ownedMystery(userId, mysteryId, true);
  if (
    !mystery.motiveOptions.some((o) => o.id === theory.motiveOptionId) ||
    !(await Suspect.exists({ _id: theory.suspectId, mysteryId })) ||
    (await Evidence.countDocuments({ _id: { $in: theory.evidenceIds }, mysteryId })) !==
      theory.evidenceIds.length
  )
    throw new AppError(
      400,
      'INVALID_ACCUSATION',
      'The chosen suspect, motive or evidence does not belong to this case.',
    );
  const solution = await MysterySolution.findOne({ mysteryId });
  if (!solution) throw missing();
  const { result } = await changeProgress(userId, mysteryId, (p) => {
    if (p.accusations.length >= 2)
      throw new AppError(
        409,
        'INVESTIGATION_COMPLETED',
        'This investigation is already completed.',
      );
    const correct = String(solution.culpritSuspectId) === theory.suspectId;
    p.accusations.push({ ...theory, correct, at: new Date() });
    const resolved = correct || p.accusations.length === 2;
    if (!resolved)
      return { correct: false, resolved: false, attemptsRemaining: 1, nudge: solution.nudge };
    const scored = scoreTheory({
      correct,
      attempt: p.accusations.length,
      motiveCorrect: solution.correctMotiveOptionId === theory.motiveOptionId,
      evidenceIds: theory.evidenceIds,
      keyEvidenceIds: solution.keyEvidenceIds,
      hintsUsed: p.hintsUsed,
    });
    p.status = 'completed';
    p.result = { score: scored.score, rank: scored.rank, completedAt: new Date() };
    return { correct, resolved: true, score: scored.score, rank: scored.rank };
  });
  return result;
}
export async function getResults(userId, mysteryId) {
  const mystery = await ownedMystery(userId, mysteryId, true),
    progress = await InvestigationProgress.findOne({ userId, mysteryId });
  if (!progress || progress.status !== 'completed')
    throw new AppError(
      409,
      'INVESTIGATION_NOT_COMPLETED',
      'Complete the investigation before opening its solution.',
    );
  const solution = await MysterySolution.findOne({ mysteryId }),
    suspects = await Suspect.find({ mysteryId }),
    evidence = await Evidence.find({ mysteryId }).select('title description category');
  if (!solution) throw missing();
  const culprit = suspects.find((s) => String(s._id) === String(solution.culpritSuspectId)),
    last = progress.accusations.at(-1),
    chosen = suspects.find((s) => String(s._id) === String(last.suspectId)),
    scored = scoreTheory({
      correct: last.correct,
      attempt: progress.accusations.length,
      motiveCorrect: last.motiveOptionId === solution.correctMotiveOptionId,
      evidenceIds: last.evidenceIds,
      keyEvidenceIds: solution.keyEvidenceIds,
      hintsUsed: progress.hintsUsed,
    });
  const existing = (id) => evidence.find((e) => String(e._id) === String(id));
  if (
    !culprit ||
    solution.keyEvidenceIds.some((id) => !existing(id)) ||
    solution.redHerrings.some((r) => !existing(r.evidenceId))
  )
    throw new AppError(500, 'INTERNAL_SERVER_ERROR', 'The solution could not be loaded.');
  return {
    title: mystery.title,
    culprit: {
      id: String(culprit._id),
      name: culprit.name,
      occupation: culprit.occupation,
      portraitAssetId: String(culprit.portraitAssetId),
    },
    motive: solution.motive,
    method: solution.method,
    opportunity: solution.opportunity,
    timeline: solution.canonicalTimeline.map((e) => ({ time: e.time, event: e.event })),
    keyEvidence: solution.keyEvidenceIds.map((id) => {
      const e = existing(id);
      return {
        id: String(e._id),
        title: e.title,
        description: e.description,
        category: e.category,
      };
    }),
    redHerrings: solution.redHerrings.map((r) => ({
      evidenceId: String(r.evidenceId),
      title: existing(r.evidenceId).title,
      explanation: r.explanation,
    })),
    explanation: solution.explanation.replace(
      /\[([a-f\d]{24})\]/g,
      (_match, id) => existing(id)?.title || 'case evidence',
    ),
    result: {
      score: progress.result.score,
      rank: progress.result.rank,
      completedAt: progress.result.completedAt,
      correct: last.correct,
      attemptsUsed: progress.accusations.length,
      hintsUsed: progress.hintsUsed,
      breakdown: scored.breakdown,
    },
    submittedTheory: {
      suspectName: chosen?.name,
      motiveOptionText: mystery.motiveOptions.find((m) => m.id === last.motiveOptionId)?.text,
      motiveCorrect: last.motiveOptionId === solution.correctMotiveOptionId,
      evidenceIds: last.evidenceIds.map(String),
    },
    fictionLabel: 'This case and its solution are AI-generated fiction.',
  };
}
