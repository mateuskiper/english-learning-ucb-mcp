import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getNextWord } from "../db/queries.js";

export function registerGetNextWord(server: McpServer, db: D1Database): void {
  server.registerTool(
    "get_next_word",
    {
      title: "Get Next Word",
      description:
        "Return the single word with the highest UCB score — the most important word to practice right now. " +
        "Call this at the start of each quiz round to pick the next word to quiz the learner on. " +
        "If the list is empty, a message is returned indicating there are no words to practice.",
    },
    async () => {
      const word = await getNextWord(db);

      if (!word) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: "No words in the vocabulary list. Add some words first.",
              }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(word),
          },
        ],
      };
    },
  );
}
