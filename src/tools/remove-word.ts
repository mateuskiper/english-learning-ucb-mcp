import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { deleteWord } from "../db/queries.js";

export function registerRemoveWord(server: McpServer, db: D1Database): void {
  server.registerTool(
    "remove_word",
    {
      title: "Remove Word",
      description:
        "Remove a word from the vocabulary list by its ID. " +
        "Use this when the learner has fully mastered a word and no longer needs to practice it, " +
        "or to remove a word that was added by mistake.",
      inputSchema: z.object({
        word_id: z.string().describe("The UUID of the word to remove"),
      }),
    },
    async ({ word_id }) => {
      const deleted = await deleteWord(db, word_id);

      if (!deleted) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: `Word with id "${word_id}" not found.`,
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
            text: JSON.stringify({
              success: true,
              message: "Word removed successfully.",
            }),
          },
        ],
      };
    },
  );
}
