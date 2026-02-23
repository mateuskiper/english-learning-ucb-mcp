import { calculateUcbScore, UCB_INITIAL_SCORE } from "../ucb.js";
import type { WordRow } from "./schema.js";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Return all words sorted by UCB score descending. */
export async function listWords(
  db: D1Database,
  limit: number,
): Promise<WordRow[]> {
  const result = await db
    .prepare("SELECT * FROM words ORDER BY ucb_score DESC LIMIT ?")
    .bind(limit)
    .all<WordRow>();
  return result.results;
}

/** Return the single word with the highest UCB score. */
export async function getNextWord(db: D1Database): Promise<WordRow | null> {
  return db
    .prepare("SELECT * FROM words ORDER BY ucb_score DESC LIMIT 1")
    .first<WordRow>();
}

/** Find a word by its id. */
export async function getWordById(
  db: D1Database,
  id: string,
): Promise<WordRow | null> {
  return db.prepare("SELECT * FROM words WHERE id = ?").bind(id).first<WordRow>();
}

/** Get total number of trials across all words. */
export async function getTotalTrials(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COALESCE(SUM(trials), 0) AS total FROM words")
    .first<{ total: number }>();
  return row?.total ?? 0;
}

/** Get aggregate stats. */
export async function getAggregateStats(db: D1Database): Promise<{
  totalWords: number;
  totalTrials: number;
  totalErrors: number;
  neverAttempted: number;
}> {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS total_words,
         COALESCE(SUM(trials), 0) AS total_trials,
         COALESCE(SUM(errors), 0) AS total_errors,
         SUM(CASE WHEN trials = 0 THEN 1 ELSE 0 END) AS never_attempted
       FROM words`,
    )
    .first<{
      total_words: number;
      total_trials: number;
      total_errors: number;
      never_attempted: number;
    }>();

  return {
    totalWords: row?.total_words ?? 0,
    totalTrials: row?.total_trials ?? 0,
    totalErrors: row?.total_errors ?? 0,
    neverAttempted: row?.never_attempted ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Insert a new word with initial UCB score. */
export async function insertWord(
  db: D1Database,
  word: Omit<WordRow, "ucb_score">,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO words (id, word, translation, example_sentence, trials, errors, ucb_score, added_at, last_reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      word.id,
      word.word,
      word.translation,
      word.example_sentence,
      word.trials,
      word.errors,
      UCB_INITIAL_SCORE,
      word.added_at,
      word.last_reviewed_at,
    )
    .run();
}

/** Delete a word by id. Returns true if a row was deleted. */
export async function deleteWord(
  db: D1Database,
  id: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM words WHERE id = ?")
    .bind(id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/** Update mutable fields (translation, example_sentence) of a word. */
export async function updateWordFields(
  db: D1Database,
  id: string,
  fields: { translation?: string; example_sentence?: string },
): Promise<boolean> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (fields.translation !== undefined) {
    sets.push("translation = ?");
    values.push(fields.translation);
  }
  if (fields.example_sentence !== undefined) {
    sets.push("example_sentence = ?");
    values.push(fields.example_sentence);
  }

  if (sets.length === 0) return false;

  values.push(id);
  const result = await db
    .prepare(`UPDATE words SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/** Increment trials (and errors if failed) for a word, then recalculate ALL UCB scores. */
export async function recordAttempt(
  db: D1Database,
  wordId: string,
  success: boolean,
): Promise<WordRow | null> {
  const now = new Date().toISOString();

  // 1. Update the target word
  const updateSql = success
    ? "UPDATE words SET trials = trials + 1, last_reviewed_at = ? WHERE id = ?"
    : "UPDATE words SET trials = trials + 1, errors = errors + 1, last_reviewed_at = ? WHERE id = ?";

  const updateResult = await db
    .prepare(updateSql)
    .bind(now, wordId)
    .run();

  if ((updateResult.meta?.changes ?? 0) === 0) {
    return null; // word not found
  }

  // 2. Recalculate UCB scores for ALL words (N changed)
  await recalculateAllUcbScores(db);

  // 3. Return the updated word
  return getWordById(db, wordId);
}

/** Recalculate and persist UCB scores for every word in the list. */
export async function recalculateAllUcbScores(db: D1Database): Promise<void> {
  const totalTrials = await getTotalTrials(db);

  const allWords = await db
    .prepare("SELECT id, trials, errors FROM words")
    .all<{ id: string; trials: number; errors: number }>();

  const batch: D1PreparedStatement[] = [];
  for (const w of allWords.results) {
    const score = calculateUcbScore(w.errors, w.trials, totalTrials);
    batch.push(
      db.prepare("UPDATE words SET ucb_score = ? WHERE id = ?").bind(score, w.id),
    );
  }

  if (batch.length > 0) {
    await db.batch(batch);
  }
}
