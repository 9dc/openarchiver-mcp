#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "node:http";
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

async function main() {
  if (TRANSPORT === "http") {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });
    await server.connect(transport);

    const httpServer = createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");

      if (req.method === "OPTIONS") {
        res.writeHead(204).end();
        return;
      }

      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ status: "ok" }));
        return;
      }

      if (req.url === "/mcp" || req.url?.startsWith("/mcp")) {
        await transport.handleRequest(req, res);
        return;
      }

      res.writeHead(404).end();
    });

    httpServer.listen(PORT, HOST, () => {
      console.error(
        `Open Archiver MCP server running on http://${HOST}:${PORT}/mcp (${READONLY ? "read-only" : "FULL ACCESS — writes enabled"})`,
      );
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(
      `Open Archiver MCP server running on stdio (${READONLY ? "read-only" : "FULL ACCESS — writes enabled"})`,
    );
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
