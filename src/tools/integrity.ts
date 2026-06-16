import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getJson } from "../client.js";

export function registerIntegrityTool(server: McpServer) {
  server.tool(
    "check_integrity",
    "Verify SHA-256 hashes of an archived email and all its attachments against stored hashes",
    {
      id: z.string().describe("UUID of the archived email to verify"),
    },
    async ({ id }) => {
      const result = await getJson(`/v1/integrity/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}