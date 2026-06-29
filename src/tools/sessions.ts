import { z } from "zod";
import { odataClient, resolveFolderId, folderHeader } from "../client.js";
import type { ODataResponse, SessionDto } from "../types/orchestrator.js";

export const sessionTools = [
  {
    name: "get_sessions",
    description: "Lists active robot sessions in a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<SessionDto>>("Sessions", {
        params: { $top: 200 },
        ...folderHeader(folderId),
      });
      return res.data.value.map((s) => ({
        sessionId: s.SessionId,
        machineId: s.MachineId,
        machineName: s.MachineName,
        hostMachineName: s.HostMachineName,
        robotUserName: s.RobotUserName,
        state: s.State,
        runtimeType: s.RuntimeType,
        reportingTime: s.ReportingTime,
        isUnresponsive: s.IsUnresponsive,
      }));
    },
  },

  {
    name: "get_machine_sessions",
    description: "Gets all robot sessions for a specific machine template.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      machineId: z.number().describe("Machine template ID"),
    }),
    async handler({ folderName, machineId }: { folderName: string; machineId: number }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<SessionDto>>(
        "Sessions/UiPath.Server.Configuration.OData.GetMachineSessions",
        {
          params: { $top: 200, key: machineId },
          ...folderHeader(folderId),
        }
      );
      return res.data.value.map((s) => ({
        sessionId: s.SessionId,
        machineId: s.MachineId,
        machineName: s.MachineName,
        hostMachineName: s.HostMachineName,
        robotUserName: s.RobotUserName,
        state: s.State,
        runtimeType: s.RuntimeType,
        reportingTime: s.ReportingTime,
      }));
    },
  },

  {
    name: "get_global_sessions",
    description: "Gets all active robot sessions across all folders in the tenant.",
    inputSchema: z.object({}),
    async handler(_args: Record<string, never>) {
      const res = await odataClient.get<ODataResponse<SessionDto>>(
        "Sessions/UiPath.Server.Configuration.OData.GetGlobalSessions",
        { params: { $top: 500 } }
      );
      return res.data.value.map((s) => ({
        sessionId: s.SessionId,
        machineId: s.MachineId,
        machineName: s.MachineName,
        hostMachineName: s.HostMachineName,
        robotUserName: s.RobotUserName,
        state: s.State,
        runtimeType: s.RuntimeType,
        reportingTime: s.ReportingTime,
        isUnresponsive: s.IsUnresponsive,
      }));
    },
  },
] as const;
