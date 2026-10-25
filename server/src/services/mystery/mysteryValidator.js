import { PROFILES } from '../../../../shared/constants/index.js';
import { evidenceContentSchemas } from '../../../../shared/schemas/index.js';
import {
  planSchema,
  suspectsSchema,
  evidencePlanSchema,
  evidenceWriteSchema,
  explanationSchema,
} from '../../validators/generation.js';
import { scanPublic } from './dto.js';
export function publicDraft(draft) {
  return {
    title: draft.plan.title,
    premise: draft.plan.premise,
    incident: {
      summary: draft.plan.incident.summary,
      location: draft.plan.incident.location,
      whenLabel: draft.plan.incident.whenLabel,
    },
    motiveOptions: draft.plan.motiveOptions,
    suspects: draft.suspects.suspects.map(
      ({
        id,
        name,
        age,
        occupation,
        background,
        relationshipToIncident,
        publicMotive,
        alibi,
        initialStatement,
      }) => ({
        id,
        name,
        age,
        occupation,
        background,
        relationshipToIncident,
        publicMotive,
        alibi,
        initialStatement,
      }),
    ),
    evidence: draft.evidencePlan.items.map((e) => ({
      id: e.id,
      category: e.category,
      title: e.title,
      description: e.description,
      source: { label: e.sourceLabel },
      occurredAt: e.occurredAt,
      relatedSuspectIds: e.relatedSuspectIds,
      content: draft.evidence[e.id]?.content,
    })),
  };
}
export function validateCase(draft, { difficulty, suspectCount }, { requireAssets = false } = {}) {
  const findings = [];
  const fail = (recordId, message, repairTarget = recordId) =>
    findings.push({ severity: 'critical', recordId, message, suggestedFix: message, repairTarget });
  for (const [key, schema] of Object.entries({
    plan: planSchema,
    suspects: suspectsSchema,
    evidencePlan: evidencePlanSchema,
    explanation: explanationSchema,
  })) {
    if (!schema.safeParse(draft[key]).success) fail(key, 'Schema validation failed');
  }
  if (findings.length) return { pass: false, findings };
  const p = draft.plan,
    s = draft.suspects.suspects,
    items = draft.evidencePlan.items,
    profile = PROFILES[difficulty],
    facts = new Set(p.facts.map((f) => f.id)),
    suspects = new Set(s.map((v) => v.id)),
    evidenceIds = new Set(items.map((v) => v.id));
  const unique = (arr) => new Set(arr).size === arr.length;
  if (
    s.length !== suspectCount ||
    p.suspectIds.length !== suspectCount ||
    !unique(s.map((v) => v.id)) ||
    p.suspectIds.some((v) => !suspects.has(v))
  )
    fail('suspects', 'Requested distinct suspect count does not match');
  if (!suspects.has(p.culpritSuspectId)) fail('plan', 'Missing culprit');
  if (items.length < profile.min || items.length > profile.max || !unique(items.map((v) => v.id)))
    fail('evidencePlan', 'Evidence count or IDs do not match difficulty');
  if (
    !unique(p.facts.map((v) => v.id)) ||
    !unique(p.motiveOptions.map((v) => v.id)) ||
    !p.motiveOptions.some((v) => v.id === p.correctMotiveOptionId)
  )
    fail('plan', 'Invalid facts or motive options');
  const start = Date.parse(p.incident.startsAt),
    end = Date.parse(p.incident.endsAt),
    inWindow = (v) =>
      Number.isFinite(Date.parse(v)) && Date.parse(v) >= start && Date.parse(v) <= end;
  const ordered = (arr) => arr.every((v, i) => i === 0 || Date.parse(v) >= Date.parse(arr[i - 1]));
  if (start > end || !ordered(p.canonicalTimeline.map((v) => v.time)))
    fail('plan', 'Invalid canonical timeline');
  for (const entry of p.canonicalTimeline)
    if (!inWindow(entry.time) || entry.factIds.some((id) => !facts.has(id)))
      fail('plan', 'Timeline fact or time outside the incident');
  const timelineFacts = new Set(p.canonicalTimeline.flatMap((v) => v.factIds));
  for (const f of p.facts)
    if (!inWindow(f.time) || !timelineFacts.has(f.id))
      fail(f.id, 'Fact missing from the canonical timeline or outside window', 'plan');
  for (const [category, count] of Object.entries({
    message: 2,
    image: 2,
    cctv: 1,
    document: 1,
    witness_statement: 1,
    timeline: 1,
  }))
    if (items.filter((e) => e.category === category).length < count)
      fail('evidencePlan', `Missing required ${category} evidence`);
  const established = new Set(items.flatMap((e) => e.establishes));
  const contradictionFacts = new Set(
    s.flatMap((v) => v.claims.map((c) => c.contradictedByFactId).filter(Boolean)),
  );
  for (const chainFact of Object.values(p.chain))
    if (!facts.has(chainFact) || !established.has(chainFact))
      fail('evidencePlan', 'Culprit motive/means/opportunity is not established');
  const culprit = s.find((v) => v.id === p.culpritSuspectId);
  if (
    !culprit?.claims.some((c) => c.contradictedByFactId && established.has(c.contradictedByFactId))
  )
    fail('suspects', 'No established contradiction exposes the culprit');
  for (const person of s) {
    for (const claim of person.claims)
      if (claim.contradictedByFactId && !facts.has(claim.contradictedByFactId))
        fail(person.id, 'Claim references a missing fact');
    if (
      person.id !== p.culpritSuspectId &&
      (!person.excludedByFactIds.length ||
        person.excludedByFactIds.some((f) => !facts.has(f) || !established.has(f)))
    )
      fail(person.id, 'Innocent suspect has no established exclusion path');
    if (person.id === p.culpritSuspectId && person.excludedByFactIds.length)
      fail(person.id, 'Culprit must not have an exclusion path');
  }
  for (const item of items) {
    const written = draft.evidence[item.id];
    if (
      !written ||
      !evidenceWriteSchema(item.category).safeParse(written).success ||
      written.id !== item.id
    ) {
      fail(item.id, 'Written evidence is missing or invalid');
      continue;
    }
    if (
      !inWindow(item.occurredAt) ||
      item.establishes.some((f) => !facts.has(f)) ||
      item.relatedSuspectIds.some((v) => !suspects.has(v))
    )
      fail(item.id, 'Invalid evidence reference or timestamp', 'evidencePlan');
    if (!item.establishes.length && !(item.roles.includes('contextual') && item.purpose))
      fail(item.id, 'Orphan evidence', 'evidencePlan');
    const c = written.content;
    const times =
      item.category === 'message'
        ? c.messages.map((m) => m.sentAt)
        : item.category === 'cctv'
          ? c.frames.map((f) => f.timestamp)
          : item.category === 'timeline'
            ? c.entries.map((e) => e.time)
            : item.category === 'document'
              ? [c.createdAt]
              : item.category === 'witness_statement'
                ? [c.interviewedAt]
                : [];
    if (times.some((t) => !inWindow(t)) || !ordered(times))
      fail(item.id, 'Evidence timestamps are invalid or out of order');
    const refs =
      item.category === 'message'
        ? c.messages.map((m) => m.senderSuspectId).filter(Boolean)
        : item.category === 'witness_statement'
          ? c.relatedSuspectIds
          : item.category === 'timeline'
            ? c.entries.flatMap((e) => e.relatedSuspectIds)
            : [];
    if (refs.some((v) => !suspects.has(v)))
      fail(item.id, 'Evidence content references a foreign suspect');
    const referenced =
      item.category === 'image'
        ? [c.assetId]
        : item.category === 'cctv'
          ? c.frames.map((f) => f.assetId)
          : [];
    if (
      !unique(written.assets.map((a) => a.key)) ||
      written.assets.length !== referenced.length ||
      referenced.some((key) => !written.assets.some((a) => a.key === key))
    )
      fail(item.id, 'Image prompts and content assets do not match');
    if (requireAssets && referenced.some((key) => !draft.assets?.[key]))
      fail(item.id, 'Required asset is not ready');
    if (!evidenceContentSchemas[item.category].safeParse(c).success)
      fail(item.id, 'Invalid category content');
  }
  const ep = draft.evidencePlan;
  for (const id of [
    ...ep.keyEvidenceIds,
    ...ep.contradictionEvidenceIds,
    ...ep.redHerrings.map((v) => v.evidenceId),
    ...draft.explanation.evidenceIds,
  ])
    if (!evidenceIds.has(id)) fail('evidencePlan', 'Unknown referenced evidence');
  if (ep.keyEvidenceIds.length < profile.keys || !unique(ep.keyEvidenceIds))
    fail('evidencePlan', 'Insufficient distinct key evidence');
  const keyFacts = new Set(
    items.filter((e) => ep.keyEvidenceIds.includes(e.id)).flatMap((e) => e.establishes),
  );
  if (Object.values(p.chain).some((f) => !keyFacts.has(f)))
    fail('evidencePlan', 'Key evidence does not establish the complete culprit chain');
  if (ep.redHerrings.length < profile.herrings)
    fail('evidencePlan', 'Insufficient explainable red herrings');
  for (const h of ep.redHerrings)
    if (!items.find((e) => e.id === h.evidenceId)?.roles.includes('red_herring'))
      fail(h.evidenceId, 'Red herring role is missing', 'evidencePlan');
  for (const id of ep.contradictionEvidenceIds) {
    const e = items.find((v) => v.id === id);
    if (
      e &&
      (!e.roles.includes('contradicting') || !e.establishes.some((f) => contradictionFacts.has(f)))
    )
      fail(id, 'Contradiction evidence does not contradict a documented claim', 'evidencePlan');
  }
  if (
    culprit &&
    [...p.hints, p.nudge].some((h) => h.toLowerCase().includes(culprit.name.toLowerCase()))
  )
    fail('plan', 'Hints or nudge directly name the culprit');
  if (requireAssets && s.some((person) => !draft.assets?.[`A${person.id}`]))
    fail('assets', 'Required suspect portrait is not ready');
  if (scanPublic(publicDraft(draft)).length)
    fail('public', 'Private fields found in public payload');
  return { pass: findings.length === 0, findings };
}
