import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { updateWordFields, getWordById } from "../db/queries.js";

export function registerUpdateWord(server: McpServer, db: D1Database): void {
  server.registerTool(
    "update_word",
    {
      title: "Update Word",
      description:
        "Update the Portuguese translation or example sentence of an existing word. " +
        "Use this to correct a translation or add/change the example sentence. " +
        "At least one of translation or example_sentence must be provided.",
      inputSchema: z.object({
        word_id: z.string().describe("The UUID of the word to update"),
        translation: z
          .string()
          .optional()
          .describe("New Portuguese translation"),
        example_sentence: z
          .string()
          .optional()
          .describe("New example sentence in English"),
      }),
    },
    async ({ word_id, translation, example_sentence }) => {
      if (translation === undefined && example_sentence === undefined) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error:
                  "At least one of translation or example_sentence must be provided.",
              }),
            },
          ],
          isError: true,
        };
      }

      const updated = await updateWordFields(db, word_id, {
        translation: translation?.trim(),
        example_sentence: example_sentence?.trim(),
      });

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

      const word = await getWordById(db, word_id);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              message: "Word updated successfully.",
              word,
            }),
          },
        ],
      };
    },
  );
}
