import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { recordAttempt } from "../db/queries.js";

export function registerRecordAttempt(server: McpServer, db: D1Database): void {
  server.registerTool(
    "record_attempt",
    {
      title: "Record Attempt",
      description:
        "Record the result of a quiz attempt for a given word. " +
        "After the learner responds to a quiz question, call this tool with the word's ID " +
        "and whether they answered correctly (success: true) or incorrectly (success: false). " +
        "This updates the word's statistics and recalculates UCB scores for all words so the " +
        "practice order adapts to the learner's performance.",
      inputSchema: z.object({
        word_id: z.string().describe("The UUID of the word that was quizzed"),
        success: z
          .boolean()
          .describe("true if the learner answered correctly, false otherwise"),
      }),
    },
    async ({ word_id, success }) => {
      const updated = await recordAttempt(db, word_id, success);

      if (!updated) {
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
              message: `Attempt recorded for "${updated.word}".`,
              word: updated,
            }),
          },
        ],
      };
    },
  );
}
