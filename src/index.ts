import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { folderTools } from "./tools/folders.js";
import { userTools } from "./tools/users.js";
import { machineTools } from "./tools/machines.js";
import { processTools } from "./tools/processes.js";
import { releaseTools } from "./tools/releases.js";
import { robotTools } from "./tools/robots.js";
import { sessionTools } from "./tools/sessions.js";
import { webhookTools } from "./tools/webhooks.js";
import { auditTools } from "./tools/audit.js";
import { jobTools } from "./tools/jobs.js";
import { scheduleTools } from "./tools/schedules.js";
import { datetimeTools } from "./tools/datetime.js";
import { queueTools } from "./tools/queues.js";
import { assetTools } from "./tools/assets.js";
import { logTools } from "./tools/logs.js";
import { alertTools } from "./tools/alerts.js";

const server = new McpServer({
  name: "uipath-orchestrator",
  version: "1.0.0",
});

type Tool = {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
};

const allTools: Tool[] = [
  ...folderTools,
  ...userTools,
  ...machineTools,
  ...processTools,
  ...releaseTools,
  ...robotTools,
  ...sessionTools,
  ...webhookTools,
  ...auditTools,
  ...jobTools,
  ...scheduleTools,
  ...queueTools,
  ...assetTools,
  ...logTools,
  ...alertTools,
  ...datetimeTools,
] as unknown as Tool[];

for (const tool of allTools) {
  server.tool(
    tool.name,
    tool.description,
    // Convert zod schema to plain object schema for MCP SDK
    tool.inputSchema instanceof z.ZodObject
      ? tool.inputSchema.shape
      : {},
    async (args: Record<string, unknown>) => {
      process.stderr.write(`[tool] ${tool.name} ${JSON.stringify(args)}\n`);
      try {
        const result = await tool.handler(args);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[error] ${tool.name}: ${message}\n`);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
