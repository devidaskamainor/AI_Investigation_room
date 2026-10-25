import { Evidence, Suspect, InvestigationProgress, MysterySolution } from '../../models/index.js';
import { ownedMystery } from '../../middleware/security.js';
import { AppError, missing } from '../../middleware/errors.js';
import { evidenceDto, suspectDto, progressDto } from '../mystery/dto.js';
export async function getProgress(userId, mysteryId) {
  await ownedMystery(userId, mysteryId, true);
  try {
    return await InvestigationProgress.findOneAndUpdate(
      { userId, mysteryId },
      {
        $setOnInsert: { status: 'in_progress', startedAt: new Date() },
        $set: { lastActivityAt: new Date() },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  } catch (e) {
    if (e.code === 11000) return InvestigationProgress.findOne({ userId, mysteryId });
    throw e;
  }
}
export async function changeProgress(userId, mysteryId, change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const progress = await getProgress(userId, mysteryId);
    if (progress.status === 'completed')
      throw new AppError(
        409,
        'INVESTIGATION_COMPLETED',
        'This investigation is already completed.',
      );
    const result = await change(progress);
    progress.lastActivityAt = new Date();
    try {
      await progress.save();
      return { progress, result };
    } catch (e) {
      if (e.name !== 'VersionError') throw e;
    }
  }
  throw new AppError(409, 'PROGRESS_CONFLICT', 'Your progress changed. Please try again.');
}
export async function listSuspects(userId, mysteryId) {
  await ownedMystery(userId, mysteryId, true);
  return { items: (await Suspect.find({ mysteryId }).sort({ _id: 1 })).map(suspectDto) };
}
export async function getSuspect(userId, mysteryId, suspectId) {
  await ownedMystery(userId, mysteryId, true);
  const record = await Suspect.findOne({ _id: suspectId, mysteryId });
  if (!record) throw missing();
  return suspectDto(record);
}
export async function listEvidence(userId, mysteryId, { category, suspectId }) {
  await ownedMystery(userId, mysteryId, true);
  const filter = { mysteryId };
  if (category) filter.category = category;
  if (suspectId) {
    if (!(await Suspect.exists({ _id: suspectId, mysteryId }))) throw missing();
    filter.relatedSuspectIds = suspectId;
  }
  return {
    items: (await Evidence.find(filter).select('-content').sort({ occurredAt: 1, _id: 1 })).map(
      (e) => evidenceDto(e),
    ),
  };
}
export async function getEvidence(userId, mysteryId, evidenceId) {
  await ownedMystery(userId, mysteryId, true);
  const evidence = await Evidence.findOne({ _id: evidenceId, mysteryId });
  if (!evidence) throw missing();
  return evidenceDto(evidence, true);
}
export async function viewEvidence(userId, mysteryId, evidenceId) {
  await getEvidence(userId, mysteryId, evidenceId);
  const p = await getProgress(userId, mysteryId);
  if (p.status === 'completed') return progressDto(p);
  const { progress } = await changeProgress(userId, mysteryId, (p) => {
    p.viewedEvidenceIds.addToSet(evidenceId);
  });
  return progressDto(progress);
}
export async function noteCreate(userId, mysteryId, text) {
  const { progress } = await changeProgress(userId, mysteryId, (p) => {
    if (p.notes.length >= 100)
      throw new AppError(409, 'NOTE_LIMIT_REACHED', 'This case already has 100 notes.');
    p.notes.push({ text });
  });
  return progressDto(progress);
}
export async function noteUpdate(userId, mysteryId, noteId, text) {
  const { progress } = await changeProgress(userId, mysteryId, (p) => {
    const note = p.notes.id(noteId);
    if (!note) throw missing();
    note.text = text;
  });
  return progressDto(progress);
}
export async function noteDelete(userId, mysteryId, noteId) {
  const { progress } = await changeProgress(userId, mysteryId, (p) => {
    const note = p.notes.id(noteId);
    if (!note) throw missing();
    note.deleteOne();
  });
  return progressDto(progress);
}
export async function replacePins(userId, mysteryId, pins) {
  await ownedMystery(userId, mysteryId, true);
  if (
    (await Evidence.countDocuments({ mysteryId, _id: { $in: pins.map((p) => p.evidenceId) } })) !==
    pins.length
  )
    throw new AppError(400, 'VALIDATION_ERROR', 'A pinned item does not belong to this case.');
  const { progress } = await changeProgress(userId, mysteryId, (p) => {
    p.pins = pins;
  });
  return progressDto(progress);
}
export async function nextHint(userId, mysteryId) {
  const { progress, result } = await changeProgress(userId, mysteryId, async (p) => {
    if (p.hintsUsed >= 3)
      throw new AppError(409, 'HINT_LIMIT_REACHED', 'You have used all three hints.');
    const solution = await MysterySolution.findOne({ mysteryId }).select('hints');
    if (!solution) throw missing();
    const hint = solution.hints[p.hintsUsed];
    p.hintsUsed += 1;
    return hint;
  });
  return { hint: result, hintsUsed: progress.hintsUsed };
}
