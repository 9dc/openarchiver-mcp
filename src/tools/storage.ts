import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { download } from "../client.js";

export function registerStorageTool(server: McpServer) {
  server.tool(
    "download_file",
    "Download a file from the configured storage backend (local filesystem or S3-compatible)",
    {
      path: z.string().describe("Relative storage path of the file (e.g. 'open-archiver/emails/abc123.eml')"),
    },
    async ({ path }) => {
      const result = await download(path);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}