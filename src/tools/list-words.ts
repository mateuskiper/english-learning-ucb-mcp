import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listWords } from "../db/queries.js";

export function registerListWords(server: McpServer, db: D1Database): void {
  server.registerTool(
    "list_words",
    {
      title: "List Words",
      description:
        "Return all vocabulary words sorted by UCB score (highest first). " +
        "Words at the top are the ones the learner should practice next — either because " +
        "they have never been attempted or because they have a high error rate. " +
        "Use the optional limit parameter to control how many words to return.",
      inputSchema: z.object({
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(50)
          .optional()
          .describe("Maximum number of words to return (default 50)"),
      }),
    },
    async ({ limit }) => {
      const words = await listWords(db, limit ?? 50);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ count: words.length, words }),
          },
        ],
      };
    },
  );
}
