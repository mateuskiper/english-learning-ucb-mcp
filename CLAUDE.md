# CLAUDE.md

This file provides guidance for AI assistants working with this codebase.

## Project Overview

**english-vocabulary-ucb-mcp** is a Model Context Protocol (MCP) server for adaptive English vocabulary learning, targeting Portuguese speakers. It is deployed as a Cloudflare Worker and uses a Cloudflare D1 (SQLite) database to persist vocabulary words and learning stats.

The adaptive ranking is powered by the **UCB1 (Upper Confidence Bound)** algorithm, which balances exploiting known-hard words with exploring less-practiced ones.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5.7 (ES Module, strict mode) |
| Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite at the edge) |
| MCP SDK | `@modelcontextprotocol/sdk ^1.25.0` |
| Agent framework | `agents ^0.5.1` |
| Schema validation | `zod ^3.24.0` |
| Build/deploy tool | `wrangler ^3.101.0` |
| CI/CD | GitHub Actions (triggered on GitHub release) |

---

## Repository Structure

```
.
├── src/
│   ├── index.ts            # Worker entrypoint; creates McpServer per request
│   ├── ucb.ts              # UCB1 algorithm implementation
│   ├── db/
│   │   ├── schema.ts       # WordRow TypeScript interface
│   │   └── queries.ts      # All D1 database helpers (reads + writes)
│   └── tools/
│       ├── index.ts        # registerAllTools() – aggregates all tool registrations
│       ├── add-word.ts     # add_word tool
│       ├── list-words.ts   # list_words tool
│       ├── get-next-word.ts  # get_next_word tool
│       ├── record-attempt.ts # record_attempt tool
│       ├── remove-word.ts  # remove_word tool
│       ├── update-word.ts  # update_word tool
│       └── get-stats.ts    # get_stats tool
├── schema.sql              # D1 table definition and indexes (destructive: DROP IF EXISTS)
├── wrangler.toml           # Cloudflare Workers + D1 binding configuration
├── tsconfig.json           # TypeScript config (strict, noEmit, bundler resolution)
├── package.json            # Scripts and dependencies
└── .github/workflows/
    └── deploy.yml          # CI/CD: typecheck → migrate → deploy on GitHub release
```

---

## Key Conventions

### MCP Tool Pattern

Every tool lives in `src/tools/<tool-name>.ts` and exports a single `register*` function:

```typescript
export function registerToolName(server: McpServer, db: D1Database): void {
  server.tool("tool_name", "Description", { /* zod schema */ }, async (params) => {
    // implementation
    return { content: [{ type: "text", text: "..." }] };
  });
}
```

All tools must be imported and called inside `registerAllTools()` in `src/tools/index.ts`.

### Database Access

- All SQL lives in `src/db/queries.ts`. Tools should never construct raw SQL themselves — add a helper there instead.
- The D1 database is injected via the `Env` interface: `env.DB` (`D1Database`).
- IDs are UUIDs generated with `crypto.randomUUID()`.
- Timestamps use `new Date().toISOString()` (ISO 8601 string stored as TEXT).

### UCB Score Lifecycle

- New words receive `UCB_INITIAL_SCORE = 1_000_000` on insert.
- Every call to `record_attempt` triggers `recalculateAllUcbScores()`, which rewrites the `ucb_score` column for **every** word using a D1 batch statement.
- The formula: `UCB(word) = (errors / trials) + sqrt(2 * ln(N) / trials)` where `N` is total trials across all words.
- Words with `trials === 0` always get `UCB_INITIAL_SCORE` (highest priority).

### Request Isolation

A fresh `McpServer` instance is created **per request** in `src/index.ts`. This is intentional — it prevents cross-request state leakage through shared transport instances (required by MCP SDK ≥ 1.26.0).

### TypeScript Rules

- Strict mode is on; no `any` types.
- Imports use `.js` extensions (ES module resolution via `bundler` mode).
- `tsc --noEmit` is used for type checking only; `wrangler` handles bundling.

---

## Development Commands

```bash
# Install dependencies
npm install

# Start local dev server (http://localhost:8787)
npm run dev

# Type check (no emit)
npm run typecheck

# Deploy to Cloudflare Workers
npm run deploy

# --- D1 Database (one-time setup) ---
npm run db:create           # Create D1 database in Cloudflare account
npm run db:migrate          # Apply schema.sql locally
npm run db:migrate:remote   # Apply schema.sql to production database
```

> **Warning:** `schema.sql` uses `DROP TABLE IF EXISTS` — running migrations is **destructive** and wipes all data.

---

## Environment & Secrets

### Local Development (`wrangler dev`)

Wrangler creates a local SQLite file automatically. No secrets needed for local dev.

### Production (GitHub Actions)

Three repository secrets must be configured:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Authenticates wrangler deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Identifies the Cloudflare account |
| `D1_DATABASE_ID` | UUID of the D1 database (substitute for `$D1_DATABASE_ID` in `wrangler.toml`) |

### wrangler.toml Note

`database_id = "$D1_DATABASE_ID"` is a placeholder. Wrangler resolves it from the `D1_DATABASE_ID` environment variable at deploy time. Do not hard-code the real UUID in the file.

---

## API Endpoints

| Path | Method | Description |
|---|---|---|
| `/` | GET | Health check — returns server name, version, description, and MCP endpoint |
| `/mcp` | POST | MCP protocol endpoint (handled by `agents/mcp`) |

---

## MCP Tools Reference

| Tool | Parameters | Description |
|---|---|---|
| `add_word` | `word`, `translation`, `example_sentence?` | Add a new vocabulary word; enforces UNIQUE constraint on `word` |
| `list_words` | `limit?` (1–500, default 50) | List words sorted by UCB score descending |
| `get_next_word` | — | Return the single highest-priority word for the next quiz |
| `record_attempt` | `word_id`, `success` (boolean) | Record a quiz result; triggers full UCB recalculation |
| `remove_word` | `word_id` | Delete a word by ID |
| `update_word` | `word_id`, `translation?`, `example_sentence?` | Update translation or example; at least one field required |
| `get_stats` | — | Aggregate stats: total words, trials, global success rate, never-attempted count, top 5 words by UCB |

---

## Adding a New MCP Tool

1. Create `src/tools/<tool-name>.ts` exporting a `register<ToolName>(server, db)` function.
2. Define the input schema with `zod` inline in the `server.tool()` call.
3. Add any necessary DB helpers to `src/db/queries.ts`.
4. Import and call the register function inside `registerAllTools()` in `src/tools/index.ts`.
5. Run `npm run typecheck` to verify correctness.

---

## CI/CD Pipeline

Deployment triggers automatically when a **GitHub Release is published**:

1. Checkout repository
2. Setup Node.js 20 with npm cache
3. `npm ci`
4. `npm run typecheck`
5. Run D1 migrations against production (`--remote`)
6. `wrangler deploy`

There are no automated tests beyond TypeScript type checking.

---

## Database Schema

```sql
CREATE TABLE words (
  id               TEXT PRIMARY KEY,        -- UUID
  word             TEXT NOT NULL UNIQUE,    -- English word
  translation      TEXT NOT NULL,           -- Portuguese translation
  example_sentence TEXT,                    -- Optional usage example
  trials           INTEGER NOT NULL DEFAULT 0,
  errors           INTEGER NOT NULL DEFAULT 0,
  ucb_score        REAL NOT NULL DEFAULT 1000000.0,
  added_at         TEXT NOT NULL,           -- ISO 8601 timestamp
  last_reviewed_at TEXT                     -- ISO 8601 timestamp, nullable
);

CREATE INDEX idx_words_ucb_score ON words(ucb_score DESC);
CREATE INDEX idx_words_word ON words(word);
```
