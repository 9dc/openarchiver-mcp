import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { uploadFormData } from "../client.js";

export function registerUploadTool(server: McpServer) {
  server.tool(
    "upload_file",
    "Upload a PST, EML, MBOX, or other file to temporary storage for use in a file-based ingestion source",
    {
      filePath: z.string().describe("Local path to the file to upload (PST, EML, MBOX, etc.)"),
    },
    async ({ filePath }) => {
      if (!existsSync(filePath)) {
        return { content: [{ type: "text", text: `File not found: ${filePath}` }], isError: true };
      }

      const fileBuffer = readFileSync(filePath);
      const fileName = filePath.split(/[\\/]/).pop() || "upload";
      const formData = new FormData();
      formData.append("file", new Blob([fileBuffer]), fileName);

      const result = await uploadFormData(formData);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );
}