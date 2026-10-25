import { describe, it, expect } from 'vitest';
import { scoreTheory, rankFor } from './scoring.service.js';
describe('Section 5.5 scoring', () => {
  const perfect = {
    correct: true,
    attempt: 1,
    motiveCorrect: true,
    evidenceIds: ['E1', 'E2', 'E3'],
    keyEvidenceIds: ['E1', 'E2', 'E3'],
    hintsUsed: 0,
  };
  it('awards 100 for a perfect first theory', () =>
    expect(scoreTheory(perfect)).toMatchObject({ score: 100, rank: 'Master Detective' }));
  it('awards 25 culprit points on the second accusation', () =>
    expect(scoreTheory({ ...perfect, attempt: 2 }).score).toBe(75));
  it('does not award points for a wrong final suspect', () =>
    expect(scoreTheory({ ...perfect, correct: false })).toMatchObject({
      score: 0,
      rank: 'Case Unsolved',
    }));
  it('caps evidence points and never counts duplicate citations', () =>
    expect(
      scoreTheory({ ...perfect, evidenceIds: ['E1', 'E1', 'red-herring'] }).breakdown.evidence,
    ).toBe(7));
  it.each([
    [0, 10],
    [1, 6],
    [2, 2],
    [3, 0],
  ])('deducts four efficiency points for %i hints', (hintsUsed, efficiency) =>
    expect(scoreTheory({ ...perfect, hintsUsed }).breakdown.efficiency).toBe(efficiency),
  );
  it('removes motive points for a wrong option', () =>
    expect(scoreTheory({ ...perfect, motiveCorrect: false }).score).toBe(80));
  it.each([
    [100, 'Master Detective'],
    [90, 'Master Detective'],
    [89, 'Sharp Investigator'],
    [70, 'Sharp Investigator'],
    [69, 'Rookie Sleuth'],
    [40, 'Rookie Sleuth'],
    [39, 'Case Cracker in Training'],
    [1, 'Case Cracker in Training'],
    [0, 'Case Unsolved'],
  ])('maps rank boundary %i', (score, rank) => expect(rankFor(score)).toBe(rank));
});
