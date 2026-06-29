import { z } from "zod";
import { odataClient, resolveFolderId, folderHeader } from "../client.js";
import type { ODataResponse, LogDto } from "../types/orchestrator.js";

export const logTools = [
  {
    name: "get_robot_logs",
    description:
      "Gets robot execution logs in a folder. Can filter by job key or process name. Returns up to 100 log entries ordered by timestamp descending.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      jobKey: z
        .string()
        .optional()
        .describe("Filter by job key (takes priority over processName)"),
      processName: z.string().optional().describe("Filter by process name"),
      level: z
        .enum(["Trace", "Debug", "Info", "Warn", "Error", "Fatal"])
        .optional()
        .describe("Filter by minimum log level"),
    }),
    async handler({
      folderName,
      jobKey,
      processName,
      level,
    }: {
      folderName: string;
      jobKey?: string;
      processName?: string;
      level?: string;
    }) {
      const folderId = await resolveFolderId(folderName);
      const filters: string[] = [];
      if (jobKey) filters.push(`JobKey eq ${jobKey}`);
      else if (processName) filters.push(`ProcessName eq '${processName}'`);
      if (level) filters.push(`Level eq '${level}'`);

      const res = await odataClient.get<ODataResponse<LogDto>>("RobotLogs", {
        params: {
          $top: 100,
          $orderby: "TimeStamp desc",
          ...(filters.length ? { $filter: filters.join(" and ") } : {}),
        },
        ...folderHeader(folderId),
      });
      return res.data.value.map((l) => ({
        id: l.Id,
        level: l.Level,
        message: l.Message,
        timestamp: l.TimeStamp,
        processName: l.ProcessName,
        jobKey: l.JobKey,
        robotName: l.RobotName,
        machineName: l.MachineName,
      }));
    },
  },
] as const;
