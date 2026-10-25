import { describe, expect, it } from 'vitest';
import { caseFixture } from '../../../test/fixtures/case.js';
import { canonicalPlanWindow } from './plan-window.js';

describe('canonical timeline bounds', () => {
  it('encloses history without changing the fixed truth or event timestamps', () => {
    const plan = caseFixture().plan;
    plan.incident.startsAt = '2026-01-10T22:00:00Z';
    const original = structuredClone(plan);
    const result = canonicalPlanWindow(plan);
    expect(result.incident.startsAt).toBe('2026-01-10T21:42:00.000Z');
    expect({ ...result, incident: original.incident }).toEqual(original);
    expect(plan).toEqual(original);
    expect(canonicalPlanWindow(result)).toBe(result);
  });
  it('encloses later facts while preserving the existing start and public label', () => {
    const plan = caseFixture().plan;
    plan.incident.endsAt = '2026-01-10T20:00:00Z';
    const result = canonicalPlanWindow(plan);
    expect(result.incident.endsAt).toBe('2026-01-10T21:42:00.000Z');
    expect(result.incident.startsAt).toBe(plan.incident.startsAt);
    expect(result.incident.whenLabel).toBe(plan.incident.whenLabel);
  });
  it('rejects reversed boundaries and malformed plans', () => {
    const plan = caseFixture().plan;
    plan.incident.endsAt = '2026-01-10T17:00:00Z';
    expect(() => canonicalPlanWindow(plan)).toThrow('IMMUTABLE_PLAN_INVALID');
    expect(() => canonicalPlanWindow({})).toThrow('INVALID_AI_SCHEMA');
  });
  it('indexes omitted approved facts at their existing times without inventing new facts', () => {
    const plan = caseFixture().plan;
    plan.canonicalTimeline = plan.canonicalTimeline.filter(
      (entry) => !entry.factIds.includes('F2'),
    );
    const originalFacts = structuredClone(plan.facts);
    const originalEvents = plan.canonicalTimeline.map((entry) => ({
      time: entry.time,
      event: entry.event,
    }));
    const result = canonicalPlanWindow(plan);
    expect(result.canonicalTimeline.flatMap((entry) => entry.factIds)).toContain('F2');
    expect(result.facts).toEqual(originalFacts);
    expect(
      result.canonicalTimeline.map((entry) => ({ time: entry.time, event: entry.event })),
    ).toEqual(originalEvents);
    expect(result.culpritSuspectId).toBe(plan.culpritSuspectId);
    expect(result.motive).toBe(plan.motive);
  });
});
