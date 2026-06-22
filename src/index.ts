#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { IncomingMessage } from "node:http";
import { registerSearchTool } from "./tools/search.js";
import { registerArchivedEmailTools } from "./tools/archived-email.js";
import { registerDashboardTools } from "./tools/dashboard.js";
import { registerIngestionTools } from "./tools/ingestion.js";
import { registerIntegrityTool } from "./tools/integrity.js";
import { registerStorageTool } from "./tools/storage.js";
import { registerUploadTool } from "./tools/upload.js";

// Read-only by default — safe for the team knowledge chatbot (Klaus/Beatrix).
// Set READONLY=false ONLY for an admin/automation context that needs write/admin tools.
const READONLY = process.env.READONLY !== "false";

// Transport: "stdio" (default) or "http" (Streamable HTTP for Onyx)
const TRANSPORT = process.env.TRANSPORT || "stdio";
const PORT = parseInt(process.env.PORT || "8000", 10);
const HOST = process.env.HOST || "127.0.0.1";

function createServerInstance(): McpServer {
  const server = new McpServer({
    name: "openarchiver-mcp",
    version: "1.0.0",
  });

  // Read-only tools (always available)
  registerSearchTool(server);
  registerArchivedEmailTools(server, { includeWrites: !READONLY }); // list + get; delete only with writes
  registerDashboardTools(server);
  registerIntegrityTool(server);
  registerStorageTool(server);

  // Write / admin tools (ingestion management, file upload) — excluded in read-only mode
  if (!READONLY) {
    registerIngestionTools(server);
    registerUploadTool(server);
  }

  return server;
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function writeJsonRpcError(
  res: import("node:http").ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  res
    .writeHead(status, { "Content-Type": "application/json" })
    .end(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }));
}

async function main() {
  if (TRANSPORT === "http") {
    // One transport per MCP session, keyed by the Mcp-Session-Id header.
    // A fresh transport + server is created on each `initialize` request so
    // that clients reconnecting (or multiple clients) each get their own
    // session instead of sharing a single, already-initialized transport.
    const transports: Record<string, StreamableHTTPServerTransport> = {};

    const httpServer = createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
      res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
      }

      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (!(req.url === "/mcp" || req.url?.startsWith("/mcp"))) {
        res.writeHead(404).end();
        return;
      }

      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      // Existing session — route the request straight to its transport.
      if (sessionId && transports[sessionId]) {
        await transports[sessionId].handleRequest(req, res);
        return;
      }

      // New session — only valid as a POST carrying an `initialize` request.
      if (req.method === "POST") {
        let body: unknown;
        try {
          body = await readJsonBody(req);
        } catch {
          writeJsonRpcError(res, 400, -32700, "Parse error");
          return;
        }

        if (!sessionId && isInitializeRequest(body)) {
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (id) => {
              transports[id] = transport;
            },
          });
          transport.onclose = () => {
            if (transport.sessionId) {
              delete transports[transport.sessionId];
            }
          };

          const server = createServerInstance();
          await server.connect(transport);
          await transport.handleRequest(req, res, body);
          return;
        }

        writeJsonRpcError(res, 400, -32000, "Bad Request: No valid session ID provided");
        return;
      }

      // GET (SSE) / DELETE without a known session.
      writeJsonRpcError(res, 400, -32000, "Bad Request: No valid session ID provided");
    });

    httpServer.listen(PORT, HOST, () => {
      console.error(
        `Open Archiver MCP server running on http://${HOST}:${PORT}/mcp (${READONLY ? "read-only" : "FULL ACCESS — writes enabled"})`,
      );
    });
  } else {
    const transport = new StdioServerTransport();
    await createServerInstance().connect(transport);
    console.error(
      `Open Archiver MCP server running on stdio (${READONLY ? "read-only" : "FULL ACCESS — writes enabled"})`,
    );
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
