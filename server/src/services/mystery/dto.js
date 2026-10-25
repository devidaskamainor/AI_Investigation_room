const id = (v) => (v ? String(v) : null);
export const profileDto = (v) => ({ id: id(v._id), name: v.name, email: v.email });
export function mysteryDto(v) {
  return {
    id: id(v._id),
    title: v.title,
    difficulty: v.difficulty,
    mysteryType: v.mysteryType,
    status: v.status,
    premise: v.premise,
    incident: v.incident
      ? {
          summary: v.incident.summary,
          location: v.incident.location,
          whenLabel: v.incident.whenLabel,
        }
      : null,
    motiveOptions: (v.motiveOptions || []).map((m) => ({ id: m.id, text: m.text })),
    suspectCount: v.suspectIds?.length || v.requestedSuspectCount,
    evidenceCount: v.evidenceIds?.length || 0,
    jobId: id(v.jobId),
    createdAt: v.createdAt,
    isDemo: Boolean(v.isDemo),
  };
}
export function suspectDto(v) {
  return {
    id: id(v._id),
    name: v.name,
    age: v.age,
    occupation: v.occupation,
    background: v.background,
    relationshipToIncident: v.relationshipToIncident,
    publicMotive: v.publicMotive,
    alibi: v.alibi,
    initialStatement: v.initialStatement,
    portraitAssetId: id(v.portraitAssetId),
  };
}
export function contentDto(category, c) {
  switch (category) {
    case 'message':
      return {
        participants: [...c.participants],
        messages: c.messages.map((m) => ({
          senderSuspectId: id(m.senderSuspectId),
          senderName: m.senderName,
          text: m.text,
          sentAt: m.sentAt,
          deleted: m.deleted,
        })),
      };
    case 'image':
      return { caption: c.caption, altText: c.altText, assetId: id(c.assetId) };
    case 'cctv':
      return {
        cameraLabel: c.cameraLabel,
        location: c.location,
        frames: c.frames.map((f) => ({
          assetId: id(f.assetId),
          timestamp: f.timestamp,
          caption: f.caption,
        })),
        isReconstruction: true,
      };
    case 'document':
      return { docType: c.docType, author: c.author, createdAt: c.createdAt, body: c.body };
    case 'witness_statement':
      return {
        witnessName: c.witnessName,
        interviewedAt: c.interviewedAt,
        statement: c.statement,
        relatedSuspectIds: c.relatedSuspectIds.map(id),
      };
    case 'timeline':
      return {
        entries: c.entries.map((e) => ({
          time: e.time,
          text: e.text,
          relatedSuspectIds: (e.relatedSuspectIds || []).map(id),
        })),
      };
    default:
      return { body: c.body };
  }
}
export function evidenceDto(v, detail = false) {
  return {
    id: id(v._id),
    category: v.category,
    title: v.title,
    description: v.description,
    source: { label: v.source?.label },
    occurredAt: v.occurredAt,
    relatedSuspectIds: v.relatedSuspectIds.map(id),
    assetIds: v.assetIds.map(id),
    isReconstruction: Boolean(v.isReconstruction),
    fictionLabel: 'AI-generated fiction',
    ...(detail ? { content: contentDto(v.category, v.content) } : {}),
  };
}
export function jobDto(v) {
  return {
    id: id(v._id),
    mysteryId: id(v.mysteryId),
    status: v.status,
    currentStage: v.currentStage,
    progressPercentage: v.progressPercentage,
    attempts: v.attempts,
    safeErrorMessage: v.safeErrorMessage || null,
    errorCode: v.errorCode || null,
  };
}
export function progressDto(v) {
  return {
    status: v.status,
    viewedEvidenceIds: v.viewedEvidenceIds.map(id),
    pins: v.pins.map((p) => ({ evidenceId: id(p.evidenceId), label: p.label })),
    notes: v.notes.map((n) => ({
      id: id(n._id),
      text: n.text,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
    hintsUsed: v.hintsUsed,
    attemptsRemaining: 2 - v.accusations.length,
    result:
      v.status === 'completed'
        ? { score: v.result.score, rank: v.result.rank, completedAt: v.result.completedAt }
        : null,
  };
}
export const PRIVATE_KEYS = new Set([
  'culpritSuspectId',
  'correctMotiveOptionId',
  'solutionId',
  'evidenceMap',
  'facts',
  'claims',
  'hints',
  'keyEvidenceIds',
  'contradictionEvidenceIds',
  'canonicalTimeline',
  'redHerrings',
  'generationMeta',
  'passwordHash',
  'resetTokenHash',
  'storageKey',
  'establishes',
  'roles',
  'purpose',
  'chain',
  'exclusions',
  'checkpoints',
]);
export function scanPublic(value) {
  if (Array.isArray(value)) return value.flatMap(scanPublic);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, v]) => [
    ...(PRIVATE_KEYS.has(key) ? [key] : []),
    ...scanPublic(v),
  ]);
}
