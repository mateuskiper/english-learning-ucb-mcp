# English Vocabulary UCB MCP Server

An MCP (Model Context Protocol) server deployed on **Cloudflare Workers** that manages an English vocabulary learning list with **UCB1-based adaptive ranking**. Designed to be consumed by a real-time voice agent that helps Portuguese speakers learn English.

## How It Works

The server maintains a list of English words with their Portuguese translations. Each word tracks how many times it has been quizzed and how many errors the learner made. A **UCB1 (Upper Confidence Bound)** algorithm ranks the words so that:

- **Words never attempted** surface first (exploration).
- **Words the learner struggles with** stay near the top (exploitation).
- **Well-known words** naturally sink to the bottom.

The voice agent calls `get_next_word` to pick the best word to quiz, then calls `record_attempt` after the learner responds.

## UCB1 Formula

```
UCB(word) = exploitation + exploration

exploitation = errors / trials
exploration  = sqrt(2 * ln(N) / trials)

N = total trials across ALL words
```

Words with `trials = 0` receive the maximum score so they are always practiced first.

## MCP Tools

| Tool | Description |
|------|-------------|
| `add_word` | Add a new English word with its Portuguese translation |
| `list_words` | Return all words sorted by UCB score (highest first) |
| `get_next_word` | Return the single highest-priority word to practice |
| `record_attempt` | Record a quiz result and recalculate all UCB scores |
| `remove_word` | Remove a word from the list |
| `update_word` | Update a word's translation or example sentence |
| `get_stats` | Return overall learning statistics and top 5 words to practice |

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) v3+

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create the D1 Database

```bash
npx wrangler d1 create vocabulary-db
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "vocabulary-db"
database_id = "<YOUR_DATABASE_ID>"
```

### 3. Run the Database Migration

**Locally (for development):**

```bash
npx wrangler d1 execute vocabulary-db --file=./schema.sql
```

**Remotely (for production):**

```bash
npx wrangler d1 execute vocabulary-db --file=./schema.sql --remote
```

### 4. Local Development

```bash
npm run dev
```

The server will start at `http://localhost:8787`. The MCP endpoint is at `/mcp`.

### 5. Deploy to Cloudflare

```bash
npm run deploy
```

Your MCP server will be live at `https://english-vocabulary-ucb-mcp.<your-subdomain>.workers.dev`.

## Connecting to Claude Desktop

Add the following to your Claude Desktop MCP configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "english-vocabulary": {
      "type": "streamable-http",
      "url": "https://english-vocabulary-ucb-mcp.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

## Connecting to a Claude Agent (SDK)

When using the Claude Agent SDK or any MCP-compatible client, point it to your deployed worker's `/mcp` endpoint using Streamable HTTP transport:

```
https://english-vocabulary-ucb-mcp.<your-subdomain>.workers.dev/mcp
```

## Project Structure

```
/
├── src/
│   ├── index.ts          # Worker entrypoint + MCP server setup
│   ├── tools/            # One file per MCP tool
│   │   ├── index.ts      # Registers all tools
│   │   ├── add-word.ts
│   │   ├── list-words.ts
│   │   ├── get-next-word.ts
│   │   ├── record-attempt.ts
│   │   ├── remove-word.ts
│   │   ├── update-word.ts
│   │   └── get-stats.ts
│   ├── db/
│   │   ├── schema.ts     # TypeScript type definitions
│   │   └── queries.ts    # D1 query helpers
│   └── ucb.ts            # UCB1 calculation logic
├── schema.sql            # D1 migration file
├── wrangler.toml         # Cloudflare Workers config
├── tsconfig.json
├── package.json
└── README.md
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start local development server |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run db:create` | Create the D1 database |
| `npm run db:migrate` | Run migration locally |
| `npm run db:migrate:remote` | Run migration on production |

## License

MIT
