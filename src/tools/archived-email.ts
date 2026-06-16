import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getJson, delJson } from "../client.js";

export function registerArchivedEmailTools(
  server: McpServer,
  options: { includeWrites?: boolean } = {},
) {
  server.tool(
    "list_archived_emails",
    "List archived emails for a specific ingestion source (paginated)",
    {
      ingestionSourceId: z.string().describe("ID of the ingestion source"),
      page: z.number().int().min(1).default(1).describe("Page number"),
      limit: z.number().int().min(1).max(100).default(10).describe("Items per page"),
    },
    async ({ ingestionSourceId, page, limit }) => {
      const result = await getJson(`/v1/archived-emails/ingestion-source/${ingestionSourceId}`, { page, limit });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_archived_email",
    "Get full details of a single archived email by ID, including attachments and thread",
    {
      id: z.string().describe("ID of the archived email"),
    },
    async ({ id }) => {
      const result = await getJson(`/v1/archived-emails/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  if (options.includeWrites) {
    server.tool(
      "delete_archived_email",
      "Permanently delete an archived email by ID (requires deletion enabled and not on legal hold)",
      {
        id: z.string().describe("ID of the archived email to delete"),
      },
      async ({ id }) => {
        await delJson(`/v1/archived-emails/${id}`);
        return { content: [{ type: "text", text: "Email deleted successfully." }] };
      },
    );
  }
}