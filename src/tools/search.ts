import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getJson } from "../client.js";

export function registerSearchTool(server: McpServer) {
  server.tool(
    "search_emails",
    "Full-text search across indexed archived emails using Meilisearch",
    {
      keywords: z.string().describe("Search query string (e.g. 'invoice Q4')"),
      page: z.number().int().min(1).default(1).describe("Page number for pagination"),
      limit: z.number().int().min(1).max(100).default(10).describe("Results per page"),
      matchingStrategy: z.enum(["last", "all", "frequency"]).default("last").describe("Meilisearch matching strategy"),
    },
    async ({ keywords, page, limit, matchingStrategy }) => {
      const result = await getJson("/v1/search", { keywords, page, limit, matchingStrategy });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}