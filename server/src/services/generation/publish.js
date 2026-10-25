import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { Mystery, MysterySolution, Suspect, Evidence } from '../../models/index.js';
import { ProviderError } from '../ai/retry.js';
export function stableId(mysteryId, kind, key) {
  return createHash('sha256').update(`${mysteryId}:${kind}:${key}`).digest('hex').slice(0, 24);
}
export function remapContent(category, content, suspectId, assetId) {
  const c = structuredClone(content);
  if (category === 'message')
    c.messages = c.messages.map((m) => ({
      ...m,
      senderSuspectId: m.senderSuspectId ? suspectId(m.senderSuspectId) : null,
    }));
  if (category === 'image') c.assetId = assetId(c.assetId);
  if (category === 'cctv') c.frames = c.frames.map((f) => ({ ...f, assetId: assetId(f.assetId) }));
  if (category === 'witness_statement') c.relatedSuspectIds = c.relatedSuspectIds.map(suspectId);
  if (category === 'timeline')
    c.entries = c.entries.map((e) => ({
      ...e,
      relatedSuspectIds: e.relatedSuspectIds.map(suspectId),
    }));
  return c;
}
export async function publishCase(mystery, draft, assertLease) {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (hello.setName || hello.msg === 'isdbgrid')
    return mongoose.connection.transaction((session) =>
      writePublishedCase(mystery, draft, assertLease, session),
    );
  return writePublishedCase(mystery, draft, assertLease);
}
async function writePublishedCase(mystery, draft, assertLease, session) {
  const mysteryId = mystery._id,
    sid = (key) => stableId(mysteryId, 'suspect', key),
    eid = (key) => stableId(mysteryId, 'evidence', key),
    aid = (key) => draft.assets[key];
  await assertLease();
  const suspectRecords = draft.suspects.suspects.map((s) => ({
    _id: sid(s.id),
    mysteryId,
    name: s.name,
    age: s.age,
    occupation: s.occupation,
    background: s.background,
    relationshipToIncident: s.relationshipToIncident,
    publicMotive: s.publicMotive,
    alibi: s.alibi,
    initialStatement: s.initialStatement,
    portraitAssetId: aid(`A${s.id}`),
  }));
  const evidenceRecords = draft.evidencePlan.items.map((e) => ({
    _id: eid(e.id),
    mysteryId,
    category: e.category,
    title: e.title,
    description: e.description,
    source: { label: e.sourceLabel },
    occurredAt: new Date(e.occurredAt),
    relatedSuspectIds: e.relatedSuspectIds.map(sid),
    assetIds: draft.evidence[e.id].assets.map((a) => aid(a.key)),
    isReconstruction: e.category === 'cctv',
    content: remapContent(e.category, draft.evidence[e.id].content, sid, aid),
  }));
  await Suspect.bulkWrite(
    suspectRecords.map((s) => ({
      replaceOne: { filter: { _id: s._id, mysteryId }, replacement: s, upsert: true },
    })),
    { session },
  );
  await Evidence.bulkWrite(
    evidenceRecords.map((e) => ({
      replaceOne: { filter: { _id: e._id, mysteryId }, replacement: e, upsert: true },
    })),
    { session },
  );
  await assertLease();
  const p = draft.plan,
    ep = draft.evidencePlan;
  await MysterySolution.updateOne(
    { mysteryId, frozenAt: null },
    {
      $set: {
        culpritSuspectId: sid(p.culpritSuspectId),
        correctMotiveOptionId: p.correctMotiveOptionId,
        motive: p.motive,
        method: p.method,
        opportunity: p.opportunity,
        canonicalTimeline: p.canonicalTimeline,
        facts: p.facts,
        claims: draft.suspects.suspects.flatMap((s) =>
          s.claims.map((c) => ({ ...c, suspectId: sid(s.id) })),
        ),
        evidenceMap: ep.items.map((e) => ({
          evidenceId: eid(e.id),
          establishes: e.establishes,
          roles: e.roles,
          purpose: e.purpose,
        })),
        keyEvidenceIds: ep.keyEvidenceIds.map(eid),
        contradictionEvidenceIds: ep.contradictionEvidenceIds.map(eid),
        redHerrings: ep.redHerrings.map((h) => ({ ...h, evidenceId: eid(h.evidenceId) })),
        hints: p.hints,
        nudge: p.nudge,
        explanation: draft.explanation.explanation.replace(/\bE\d+\b/g, (m) =>
          ep.items.some((e) => e.id === m) ? `[${eid(m)}]` : m,
        ),
        frozenAt: new Date(),
      },
    },
    { session },
  );
  const solution = await MysterySolution.findOne({ mysteryId })
    .select('_id frozenAt')
    .session(session || null);
  if (!solution?.frozenAt) throw new ProviderError('PUBLICATION_FAILED');
  await assertLease();
  const update = await Mystery.updateOne(
    { _id: mysteryId, ownerId: mystery.ownerId, status: { $in: ['generating', 'validating'] } },
    {
      $set: {
        title: mystery.title === 'An untitled mystery' ? p.title : mystery.title,
        premise: p.premise,
        incident: {
          summary: p.incident.summary,
          location: p.incident.location,
          whenLabel: p.incident.whenLabel,
        },
        motiveOptions: p.motiveOptions,
        suspectIds: suspectRecords.map((s) => s._id),
        evidenceIds: evidenceRecords.map((e) => e._id),
        solutionId: solution._id,
        status: 'ready',
        publishedAt: new Date(),
      },
    },
    { session },
  );
  if (update.modifiedCount !== 1) throw new ProviderError('PUBLICATION_FAILED');
}
