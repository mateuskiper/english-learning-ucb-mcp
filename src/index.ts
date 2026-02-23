import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { registerAllTools } from "./tools/index.js";

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Health-check / info endpoint
    if (url.pathname === "/") {
      return Response.json({
        name: "english-vocabulary-ucb-mcp",
        version: "1.0.0",
        description:
          "MCP server for English vocabulary learning with UCB-based adaptive ranking",
        mcp_endpoint: "/mcp",
      });
    }

    // Create a fresh McpServer per request (required by MCP SDK ≥1.26.0
    // to avoid cross-request state leaking via shared transport instances).
    const server = new McpServer({
      name: "english-vocabulary-ucb-mcp",
      version: "1.0.0",
    });

    registerAllTools(server, env.DB);

    const handler = createMcpHandler(server);
    return handler(request, env, ctx);
  },
};
