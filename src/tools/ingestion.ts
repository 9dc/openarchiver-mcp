import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getJson, postJson, putJson, delJson } from "../client.js";

export function registerIngestionTools(server: McpServer) {
  server.tool(
    "create_ingestion_source",
    "Create a new ingestion source (Google Workspace, Microsoft 365, IMAP, or file import)",
    {
      name: z.string().describe("Name for the ingestion source"),
      provider: z.string().describe("Provider type (e.g. google_workspace, microsoft_365, imap, eml, pst, mbox)"),
      providerConfig: z.record(z.unknown()).describe("Provider-specific configuration object"),
    },
    async ({ name, provider, providerConfig }) => {
      const result = await postJson("/v1/ingestion-sources", { name, provider, providerConfig });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "list_ingestion_sources",
    "List all ingestion sources (credentials are excluded)",
    {},
    async () => {
      const result = await getJson("/v1/ingestion-sources");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "get_ingestion_source",
    "Get a single ingestion source by ID (credentials excluded)",
    {
      id: z.string().describe("ID of the ingestion source"),
    },
    async ({ id }) => {
      const result = await getJson(`/v1/ingestion-sources/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "update_ingestion_source",
    "Update configuration for an existing ingestion source",
    {
      id: z.string().describe("ID of the ingestion source"),
      name: z.string().optional().describe("New name for the source"),
      provider: z.string().optional().describe("Provider type"),
      status: z.string().optional().describe("Source status"),
      providerConfig: z.record(z.unknown()).optional().describe("Updated provider configuration"),
    },
    async ({ id, name, provider, status, providerConfig }) => {
      const body: Record<string, unknown> = {};
      if (name !== undefined) body.name = name;
      if (provider !== undefined) body.provider = provider;
      if (status !== undefined) body.status = status;
      if (providerConfig !== undefined) body.providerConfig = providerConfig;
      const result = await putJson(`/v1/ingestion-sources/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "delete_ingestion_source",
    "Permanently delete an ingestion source (requires deletion enabled in settings)",
    {
      id: z.string().describe("ID of the ingestion source to delete"),
    },
    async ({ id }) => {
      await delJson(`/v1/ingestion-sources/${id}`);
      return { content: [{ type: "text", text: "Ingestion source deleted successfully." }] };
    },
  );

  server.tool(
    "trigger_import",
    "Trigger an initial import job for an ingestion source (imports all historical emails)",
    {
      id: z.string().describe("ID of the ingestion source"),
    },
    async ({ id }) => {
      const result = await postJson(`/v1/ingestion-sources/${id}/import`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "pause_ingestion_source",
    "Pause an ingestion source to stop continuous sync",
    {
      id: z.string().describe("ID of the ingestion source to pause"),
    },
    async ({ id }) => {
      const result = await postJson(`/v1/ingestion-sources/${id}/pause`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    "force_sync",
    "Trigger an out-of-schedule continuous sync for an ingestion source",
    {
      id: z.string().describe("ID of the ingestion source to sync"),
    },
    async ({ id }) => {
      const result = await postJson(`/v1/ingestion-sources/${id}/sync`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}