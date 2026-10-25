import { planSchema } from '../../validators/generation.js';
import { ProviderError } from '../ai/retry.js';

// The validation window must include the fixed truth, including motive history.
// Only the enclosing bounds change; no fact, event, answer or timestamp is rewritten.
export function canonicalPlanWindow(plan) {
  if (!planSchema.safeParse(plan).success) throw new ProviderError('INVALID_AI_SCHEMA');
  const start = Date.parse(plan.incident.startsAt);
  const end = Date.parse(plan.incident.endsAt);
  if (start > end) throw new ProviderError('IMMUTABLE_PLAN_INVALID');
  const times = [
    ...plan.facts.map((fact) => Date.parse(fact.time)),
    ...plan.canonicalTimeline.map((entry) => Date.parse(entry.time)),
  ];
  // Link already approved facts that the model omitted from its timeline index.
  // This derives entries from those facts, preserving every existing event and time.
  const timeline = structuredClone(plan.canonicalTimeline);
  const indexedFacts = new Set(timeline.flatMap((entry) => entry.factIds));
  let indexChanged = false;
  for (const fact of plan.facts) {
    if (indexedFacts.has(fact.id)) continue;
    const entry = timeline.find((entry) => Date.parse(entry.time) === Date.parse(fact.time));
    if (entry) entry.factIds.push(fact.id);
    else timeline.push({ time: fact.time, event: fact.text, factIds: [fact.id] });
    indexedFacts.add(fact.id);
    indexChanged = true;
  }
  if (indexChanged) timeline.sort((left, right) => Date.parse(left.time) - Date.parse(right.time));
  if (timeline.length > 30) throw new ProviderError('IMMUTABLE_PLAN_INVALID');
  const earliest = Math.min(start, ...times);
  const latest = Math.max(end, ...times);
  if (earliest === start && latest === end && !indexChanged) return plan;
  return {
    ...plan,
    canonicalTimeline: indexChanged ? timeline : plan.canonicalTimeline,
    incident: {
      ...plan.incident,
      startsAt: earliest < start ? new Date(earliest).toISOString() : plan.incident.startsAt,
      endsAt: latest > end ? new Date(latest).toISOString() : plan.incident.endsAt,
    },
  };
}
