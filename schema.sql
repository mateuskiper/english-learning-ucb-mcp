DROP TABLE IF EXISTS words;

CREATE TABLE words (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  translation TEXT NOT NULL,
  example_sentence TEXT,
  trials INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  ucb_score REAL NOT NULL DEFAULT 1000000.0,
  added_at TEXT NOT NULL,
  last_reviewed_at TEXT
);

CREATE INDEX idx_words_ucb_score ON words(ucb_score DESC);
CREATE INDEX idx_words_word ON words(word);
