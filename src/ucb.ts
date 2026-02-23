/**
 * UCB1 (Upper Confidence Bound) calculation for adaptive vocabulary ranking.
 *
 * Words with higher UCB scores are prioritized for practice:
 * - Words never attempted get the highest score (they need to be tried).
 * - Words with more errors get higher exploitation scores (they need more practice).
 * - Words with fewer attempts relative to others get higher exploration scores.
 */

/** Score assigned to words that have never been attempted. */
export const UCB_INITIAL_SCORE = 1_000_000.0;

/**
 * Calculate the UCB1 score for a single word.
 *
 * UCB(word) = exploitation + exploration
 *   exploitation = errors / trials
 *   exploration  = sqrt(2 * ln(N) / trials)
 *
 * @param errors   Number of incorrect answers for this word.
 * @param trials   Total attempts for this word.
 * @param totalTrials  Total attempts across ALL words (N).
 * @returns The UCB score (higher = should be practiced sooner).
 */
export function calculateUcbScore(
  errors: number,
  trials: number,
  totalTrials: number,
): number {
  if (trials === 0) {
    return UCB_INITIAL_SCORE;
  }

  const exploitation = errors / trials;
  const exploration = Math.sqrt((2 * Math.log(totalTrials)) / trials);

  return exploitation + exploration;
}
