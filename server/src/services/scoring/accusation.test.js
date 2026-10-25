import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { investigationHarness } from '../../../test/harness.js';
import { Mystery, InvestigationProgress } from '../../models/index.js';
describe('M7 accusation and trusted results', () => {
  let h, theory, wrong;
  beforeAll(async () => {
    h = await investigationHarness();
    const m = await Mystery.findById(h.id);
    theory = {
      suspectId: String(h.solution.culpritSuspectId),
      motiveOptionId: h.solution.correctMotiveOptionId,
      evidenceIds: h.solution.keyEvidenceIds.map(String),
    };
    wrong = {
      ...theory,
      suspectId: String(m.suspectIds.find((id) => String(id) !== theory.suspectId)),
    };
  });
  afterAll(async () => {
    await h?.close();
  });
  it('FR-50 blocks premature and foreign results', async () => {
    expect((await h.owner.send('get', `${h.base}/results`)).status).toBe(409);
    expect((await h.foreign.send('get', `${h.base}/results`)).status).toBe(404);
  });
  it('AC-16 rejects foreign suspect, evidence and motive options', async () => {
    for (const bad of [
      { ...theory, suspectId: '111111111111111111111111' },
      { ...theory, evidenceIds: ['111111111111111111111111'] },
      { ...theory, motiveOptionId: 'foreign' },
    ]) {
      const r = await h.owner.send('post', `${h.base}/accusation`, bad);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('INVALID_ACCUSATION');
    }
  });
  it('AC-15 wrong first attempt returns only its limited response', async () => {
    const r = await h.owner.send('post', `${h.base}/accusation`, wrong);
    expect(r.status).toBe(200);
    expect(r.body.data).toEqual({
      correct: false,
      resolved: false,
      attemptsRemaining: 1,
      nudge: h.solution.nudge,
    });
    expect((await h.owner.send('get', `${h.base}/results`)).status).toBe(409);
  });
  it('AC-15 correct second attempt ends the case and returns the exact score', async () => {
    await h.owner.send('post', `${h.base}/hints`);
    const r = await h.owner.send('post', `${h.base}/accusation`, theory);
    expect(r.body.data).toEqual({
      correct: true,
      resolved: true,
      score: 65,
      rank: 'Rookie Sleuth',
    });
  });
  it('AC-17 results use the frozen solution and existing evidence', async () => {
    const r = await h.owner.send('get', `${h.base}/results`);
    expect(r.status).toBe(200);
    expect(r.body.data.culprit.id).toBe(theory.suspectId);
    expect(r.body.data.result.score).toBe(65);
    expect(r.body.data.keyEvidence.map((e) => e.id)).toEqual(theory.evidenceIds);
    expect(r.body.data).not.toHaveProperty('generationMeta');
  });
  it('AC-18 repeated and concurrent accusations cannot replace completion', async () => {
    const results = await Promise.all([
      h.owner.send('post', `${h.base}/accusation`, wrong),
      h.owner.send('post', `${h.base}/accusation`, theory),
    ]);
    expect(results.map((r) => r.status)).toEqual([409, 409]);
    const progress = await InvestigationProgress.findOne({ mysteryId: h.id });
    expect(progress.accusations).toHaveLength(2);
    expect(progress.result.score).toBe(65);
  });
  it('FR-61 saved result survives reopening and appears in completed history', async () => {
    const history = await h.owner.send('get', '/mysteries?status=completed');
    expect(history.body.data.items).toHaveLength(1);
    expect(history.body.data.items[0].outcome).toBe('Rookie Sleuth');
    expect((await h.owner.send('get', `${h.base}/results`)).body.data.result.score).toBe(65);
  });
});
describe('AC-15 second wrong accusation', () => {
  let h, theory;
  beforeAll(async () => {
    h = await investigationHarness();
    const m = await Mystery.findById(h.id);
    theory = {
      suspectId: String(
        m.suspectIds.find((id) => String(id) !== String(h.solution.culpritSuspectId)),
      ),
      motiveOptionId: 'M1',
      evidenceIds: h.solution.keyEvidenceIds.map(String),
    };
  });
  afterAll(async () => {
    await h?.close();
  });
  it('ends with score zero and permits the reveal', async () => {
    await h.owner.send('post', `${h.base}/accusation`, theory);
    const r = await h.owner.send('post', `${h.base}/accusation`, theory);
    expect(r.body.data).toEqual({
      correct: false,
      resolved: true,
      score: 0,
      rank: 'Case Unsolved',
    });
    expect((await h.owner.send('get', `${h.base}/results`)).status).toBe(200);
  });
});
describe('AC-18 racing final submissions', () => {
  let h;
  beforeAll(async () => {
    h = await investigationHarness();
  });
  afterAll(async () => {
    await h?.close();
  });
  it('commits exactly one completed theory under concurrent requests', async () => {
    const theory = {
      suspectId: String(h.solution.culpritSuspectId),
      motiveOptionId: h.solution.correctMotiveOptionId,
      evidenceIds: h.solution.keyEvidenceIds.map(String),
    };
    const replies = await Promise.all([
      h.owner.send('post', `${h.base}/accusation`, theory),
      h.owner.send('post', `${h.base}/accusation`, theory),
    ]);
    expect(replies.map((r) => r.status).sort()).toEqual([200, 409]);
    const progress = await InvestigationProgress.findOne({ mysteryId: h.id });
    expect(progress.accusations).toHaveLength(1);
    expect(progress.result.score).toBe(94);
  });
});
