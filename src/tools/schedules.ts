import { z } from "zod";
import { odataClient, resolveFolderId, folderHeader } from "../client.js";
import type { ODataResponse, ProcessScheduleDto } from "../types/orchestrator.js";

export const scheduleTools = [
  {
    name: "get_triggers_in_folder",
    description:
      "Gets all process schedule triggers in a folder, including cron expressions, timezone, linked queue, and machine/robot assignments.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<ProcessScheduleDto>>("ProcessSchedules", {
        params: { $top: 500 },
        ...folderHeader(folderId),
      });
      return res.data.value.map((t) => ({
        id: t.Id,
        name: t.Name,
        processName: t.ReleaseName,
        description: t.Description,
        scheduleCron: t.StartProcessCron,
        timezone: t.TimeZoneIana,
        queueName: t.QueueDefinitionName,
        enabled: t.Enabled,
        priority: t.SpecificPriorityValue,
        machineRobots: t.MachineRobots?.map((mr) => ({
          machineGroup: mr.MachineName,
          hostMachine: mr.SessionName,
          robotUser: mr.RobotUserName,
        })),
      }));
    },
  },

  {
    name: "enable_disable_schedule",
    description: "Enables or disables a process schedule trigger.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      scheduleId: z.number().describe("Schedule ID"),
      enabled: z.boolean().describe("True to enable, false to disable"),
    }),
    async handler({
      folderName,
      scheduleId,
      enabled,
    }: {
      folderName: string;
      scheduleId: number;
      enabled: boolean;
    }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.post(
        "ProcessSchedules/UiPath.Server.Configuration.OData.SetEnabled",
        { scheduleId, enabled },
        folderHeader(folderId)
      );
      return { success: true, scheduleId, enabled };
    },
  },

  {
    name: "create_schedule",
    description:
      "Creates a new process schedule (time trigger). Requires a release ID and at least one robot ID.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      name: z.string().describe("Schedule name"),
      releaseId: z.number().describe("Release (process) ID to schedule"),
      robotIds: z.array(z.number()).describe("Robot user IDs that will execute the process"),
      cronExpression: z
        .string()
        .describe("Cron expression for the schedule, e.g. '0 9 * * 1-5' (9am weekdays)"),
      timezone: z
        .string()
        .default("UTC")
        .describe("IANA timezone name, e.g. 'America/New_York'"),
      enabled: z.boolean().default(true).describe("Whether the schedule starts enabled"),
    }),
    async handler({
      folderName,
      name,
      releaseId,
      robotIds,
      cronExpression,
      timezone,
      enabled,
    }: {
      folderName: string;
      name: string;
      releaseId: number;
      robotIds: number[];
      cronExpression: string;
      timezone: string;
      enabled: boolean;
    }) {
      const folderId = await resolveFolderId(folderName);
      const body = {
        Name: name,
        ReleaseId: releaseId,
        RobotIds: robotIds,
        StartProcessCron: cronExpression,
        TimeZoneIana: timezone,
        Enabled: enabled,
      };
      const res = await odataClient.post<ProcessScheduleDto>(
        "ProcessSchedules",
        body,
        folderHeader(folderId)
      );
      return { id: res.data.Id, name: res.data.Name, enabled: res.data.Enabled };
    },
  },

  {
    name: "update_schedule",
    description: "Updates an existing process schedule's cron expression, robots, or enabled state.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      scheduleId: z.number().describe("Schedule ID"),
      name: z.string().optional().describe("New schedule name"),
      cronExpression: z.string().optional().describe("New cron expression"),
      timezone: z.string().optional().describe("New IANA timezone"),
      robotIds: z.array(z.number()).optional().describe("New list of robot user IDs"),
      enabled: z.boolean().optional().describe("Enable or disable the schedule"),
    }),
    async handler({
      folderName,
      scheduleId,
      name,
      cronExpression,
      timezone,
      robotIds,
      enabled,
    }: {
      folderName: string;
      scheduleId: number;
      name?: string;
      cronExpression?: string;
      timezone?: string;
      robotIds?: number[];
      enabled?: boolean;
    }) {
      const folderId = await resolveFolderId(folderName);
      const current = await odataClient.get<ProcessScheduleDto>(
        `ProcessSchedules(${scheduleId})`,
        folderHeader(folderId)
      );
      const body = {
        ...current.data,
        Name: name ?? current.data.Name,
        StartProcessCron: cronExpression ?? current.data.StartProcessCron,
        TimeZoneIana: timezone ?? current.data.TimeZoneIana,
        RobotIds: robotIds,
        Enabled: enabled ?? current.data.Enabled,
      };
      await odataClient.put(`ProcessSchedules(${scheduleId})`, body, folderHeader(folderId));
      return { success: true, scheduleId };
    },
  },

  {
    name: "delete_schedule",
    description: "Deletes a process schedule by its ID.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      scheduleId: z.number().describe("Schedule ID to delete"),
    }),
    async handler({ folderName, scheduleId }: { folderName: string; scheduleId: number }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.delete(`ProcessSchedules(${scheduleId})`, folderHeader(folderId));
      return { success: true, scheduleId };
    },
  },
] as const;
