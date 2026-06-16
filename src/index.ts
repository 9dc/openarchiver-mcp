#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `Open Archiver MCP server running on stdio (${READONLY ? "read-only" : "FULL ACCESS — writes enabled"})`,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
