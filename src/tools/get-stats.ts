import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAggregateStats, listWords } from "../db/queries.js";

export function registerGetStats(server: McpServer, db: D1Database): void {
  server.registerTool(
    "get_stats",
    {
      title: "Get Stats",
      description:
        "Return overall learning statistics: total words, total quiz attempts, " +
        "global success rate, number of words never attempted, and the top 5 words " +
        "that most need practice (highest UCB score). Use this to give the learner " +
        "a summary of their progress.",
    },
    async () => {
      const stats = await getAggregateStats(db);
      const top5 = await listWords(db, 5);

      const globalSuccessRate =
        stats.totalTrials > 0
          ? ((stats.totalTrials - stats.totalErrors) / stats.totalTrials) * 100
          : 0;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              total_words: stats.totalWords,
              total_trials: stats.totalTrials,
              global_success_rate: `${globalSuccessRate.toFixed(1)}%`,
              words_never_attempted: stats.neverAttempted,
              top_5_words_to_practice: top5,
            }),
          },
        ],
      };
    },
  );
}
