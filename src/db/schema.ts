/** Row shape stored in the D1 `words` table. */
export interface WordRow {
  id: string;
  word: string;
  translation: string;
  example_sentence: string | null;
  trials: number;
  errors: number;
  ucb_score: number;
  added_at: string;
  last_reviewed_at: string | null;
}
