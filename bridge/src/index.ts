import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface Env {
  MCP_URL: string;
  BRIDGE_API_KEY?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function unauthorized() {
  return json({ error: "unauthorized" }, 401);
}

function badRequest(msg: string) {
  return json({ error: "bad_request", message: msg }, 400);
}

async function withMcpClient<T>(
  env: Env,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const transport = new StreamableHTTPClientTransport(new URL(env.MCP_URL));
  const client = new Client(
    { name: "mcp-rest-bridge", version: "1.0.0" },
    { capabilities: {} },
  );

  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Optional API key protection via Authorization: Bearer <key>
    if (env.BRIDGE_API_KEY) {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.startsWith("Bearer ")
        ? auth.slice("Bearer ".length)
        : "";
      if (token !== env.BRIDGE_API_KEY) return unauthorized();
    }

    // Health check
    if (url.pathname === "/" && request.method === "GET") {
      return json({
        name: "mcp-rest-bridge",
        version: "1.0.0",
        description: "REST bridge (proxy) for the English Vocabulary UCB MCP server",
        endpoints: ["/tools/list", "/tools/call"],
      });
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    // POST /tools/list
    if (url.pathname === "/tools/list") {
      try {
        const result = await withMcpClient(env, async (client) => {
          return await client.listTools();
        });
        return json(result);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return json({ error: "mcp_error", message }, 502);
      }
    }

    // POST /tools/call
    if (url.pathname === "/tools/call") {
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return badRequest("Body must be valid JSON.");
      }

      const name = body.name;
      const args = body.arguments;

      if (typeof name !== "string" || !name)
        return badRequest("Missing field: name (string).");
      if (typeof args !== "object" || args === null)
        return badRequest("Missing field: arguments (object).");

      try {
        const result = await withMcpClient(env, async (client) => {
          return await client.callTool({
            name,
            arguments: args as Record<string, unknown>,
          });
        });
        return json(result);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return json({ error: "mcp_error", message }, 502);
      }
    }

    return json({ error: "not_found" }, 404);
  },
};
