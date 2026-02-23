import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAddWord } from "./add-word.js";
import { registerListWords } from "./list-words.js";
import { registerGetNextWord } from "./get-next-word.js";
import { registerRecordAttempt } from "./record-attempt.js";
import { registerRemoveWord } from "./remove-word.js";
import { registerUpdateWord } from "./update-word.js";
import { registerGetStats } from "./get-stats.js";

/** Register every MCP tool on the given server, binding them to the D1 database. */
export function registerAllTools(server: McpServer, db: D1Database): void {
  registerAddWord(server, db);
  registerListWords(server, db);
  registerGetNextWord(server, db);
  registerRecordAttempt(server, db);
  registerRemoveWord(server, db);
  registerUpdateWord(server, db);
  registerGetStats(server, db);
}
