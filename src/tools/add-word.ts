import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { insertWord } from "../db/queries.js";

export function registerAddWord(server: McpServer, db: D1Database): void {
  server.registerTool(
    "add_word",
    {
      title: "Add Word",
      description:
        "Add a new English word to the vocabulary learning list. " +
        "Provide the English word, its Portuguese translation, and optionally an example sentence in English. " +
        "The word will start with zero attempts so it will be prioritized for practice.",
      inputSchema: z.object({
        word: z.string().describe("The English word to learn"),
        translation: z.string().describe("The Portuguese translation of the word"),
        example_sentence: z
          .string()
          .optional()
          .describe("An optional example sentence in English using the word"),
      }),
    },
    async ({ word, translation, example_sentence }) => {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      try {
        await insertWord(db, {
          id,
          word: word.trim().toLowerCase(),
          translation: translation.trim(),
          example_sentence: example_sentence?.trim() ?? null,
          trials: 0,
          errors: 0,
          added_at: now,
          last_reviewed_at: null,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Word "${word}" added successfully.`,
                word_id: id,
              }),
            },
          ],
        };
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Unknown error";

        if (message.includes("UNIQUE constraint failed")) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  success: false,
                  error: `The word "${word}" already exists in the list.`,
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
              text: JSON.stringify({ success: false, error: message }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
