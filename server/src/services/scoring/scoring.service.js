/** Pure server-side scoring function. All solution inputs come from trusted storage. */
export function rankFor(score) {
  return score >= 90
    ? 'Master Detective'
    : score >= 70
      ? 'Sharp Investigator'
      : score >= 40
        ? 'Rookie Sleuth'
        : score >= 1
          ? 'Case Cracker in Training'
          : 'Case Unsolved';
}
export function scoreTheory({
  correct,
  attempt,
  motiveCorrect,
  evidenceIds,
  keyEvidenceIds,
  hintsUsed,
}) {
  if (!correct)
    return {
      score: 0,
      rank: rankFor(0),
      breakdown: { culprit: 0, motive: 0, evidence: 0, efficiency: 0 },
    };
  const keys = new Set(keyEvidenceIds.map(String)),
    matching = [...new Set(evidenceIds.map(String))].filter((id) => keys.has(id)).length,
    breakdown = {
      culprit: attempt === 1 ? 50 : 25,
      motive: motiveCorrect ? 20 : 0,
      evidence: Math.min(20, matching * 7),
      efficiency: Math.max(0, 10 - hintsUsed * 4),
    },
    score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score, rank: rankFor(score), breakdown };
}
