import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getJson } from "../client.js";

export function registerDashboardTools(server: McpServer) {
  server.tool(
    "get_dashboard_stats",
    "Get high-level statistics: total archived emails, storage used, and failed ingestions (7 days)",
    {},
    async () => {
      const result = await getJson("/v1/dashboard/stats");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_ingestion_history",
    "Get email ingestion counts per day for the last 30 days",
    {},
    async () => {
      const result = await getJson("/v1/dashboard/ingestion-history");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_ingestion_source_summaries",
    "Get summary of all ingestion sources with their storage usage",
    {},
    async () => {
      const result = await getJson("/v1/dashboard/ingestion-sources");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_recent_syncs",
    "Get recent sync sessions across all ingestion sources",
    {},
    async () => {
      const result = await getJson("/v1/dashboard/recent-syncs");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_indexed_insights",
    "Get top-sender statistics from the search index",
    {},
    async () => {
      const result = await getJson("/v1/dashboard/indexed-insights");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}