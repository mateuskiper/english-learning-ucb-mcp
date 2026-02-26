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

async function callTool(
  env: Env,
  name: string,
  args: Record<string, unknown>,
): Promise<Response> {
  try {
    const result = await withMcpClient(env, async (client) => {
      return await client.callTool({ name, arguments: args });
    });
    return json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ error: "mcp_error", message }, 502);
  }
}

async function parseJsonBody(
  request: Request,
): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text) as Record<string, unknown>;
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
        description:
          "REST bridge (proxy) for the English Vocabulary UCB MCP server",
        endpoints: [
          "/tools/list",
          "/tools/call",
          "/add_word",
          "/list_words",
          "/get_next_word",
          "/record_attempt",
          "/remove_word",
          "/update_word",
          "/get_stats",
        ],
      });
    }

    // --- Generic MCP endpoints ---

    if (url.pathname === "/tools/list" && request.method === "POST") {
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

    if (url.pathname === "/tools/call" && request.method === "POST") {
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

      return callTool(env, name, args as Record<string, unknown>);
    }

    // --- Dedicated tool routes ---

    // POST /add_word  { word, translation, example_sentence? }
    if (url.pathname === "/add_word" && request.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await parseJsonBody(request);
      } catch {
        return badRequest("Body must be valid JSON.");
      }

      if (typeof body.word !== "string" || !body.word)
        return badRequest("Missing field: word (string).");
      if (typeof body.translation !== "string" || !body.translation)
        return badRequest("Missing field: translation (string).");

      const args: Record<string, unknown> = {
        word: body.word,
        translation: body.translation,
      };
      if (body.example_sentence !== undefined) {
        args.example_sentence = body.example_sentence;
      }

      return callTool(env, "add_word", args);
    }

    // POST /list_words  { limit? }
    if (url.pathname === "/list_words" && request.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await parseJsonBody(request);
      } catch {
        return badRequest("Body must be valid JSON.");
      }

      const args: Record<string, unknown> = {};
      if (body.limit !== undefined) {
        args.limit = body.limit;
      }

      return callTool(env, "list_words", args);
    }

    // GET /get_next_word
    if (url.pathname === "/get_next_word" && request.method === "GET") {
      return callTool(env, "get_next_word", {});
    }

    // POST /record_attempt  { word_id, success }
    if (url.pathname === "/record_attempt" && request.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await parseJsonBody(request);
      } catch {
        return badRequest("Body must be valid JSON.");
      }

      if (typeof body.word_id !== "string" || !body.word_id)
        return badRequest("Missing field: word_id (string).");
      if (typeof body.success !== "boolean")
        return badRequest("Missing field: success (boolean).");

      return callTool(env, "record_attempt", {
        word_id: body.word_id,
        success: body.success,
      });
    }

    // POST /remove_word  { word_id }
    if (url.pathname === "/remove_word" && request.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await parseJsonBody(request);
      } catch {
        return badRequest("Body must be valid JSON.");
      }

      if (typeof body.word_id !== "string" || !body.word_id)
        return badRequest("Missing field: word_id (string).");

      return callTool(env, "remove_word", { word_id: body.word_id });
    }

    // POST /update_word  { word_id, translation?, example_sentence? }
    if (url.pathname === "/update_word" && request.method === "POST") {
      let body: Record<string, unknown>;
      try {
        body = await parseJsonBody(request);
      } catch {
        return badRequest("Body must be valid JSON.");
      }

      if (typeof body.word_id !== "string" || !body.word_id)
        return badRequest("Missing field: word_id (string).");
      if (body.translation === undefined && body.example_sentence === undefined)
        return badRequest(
          "At least one of translation or example_sentence must be provided.",
        );

      const args: Record<string, unknown> = { word_id: body.word_id };
      if (body.translation !== undefined) {
        args.translation = body.translation;
      }
      if (body.example_sentence !== undefined) {
        args.example_sentence = body.example_sentence;
      }

      return callTool(env, "update_word", args);
    }

    // GET /get_stats
    if (url.pathname === "/get_stats" && request.method === "GET") {
      return callTool(env, "get_stats", {});
    }

    return json({ error: "not_found" }, 404);
  },
};
