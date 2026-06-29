import { z } from "zod";
import { odataClient, resolveFolderId, folderHeader } from "../client.js";
import type { ODataResponse, RobotDto } from "../types/orchestrator.js";

export const robotTools = [
  {
    name: "get_all_robots",
    description: "Lists all robots in a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<RobotDto>>("Robots", {
        params: { $top: 500, $orderby: "Name asc" },
        ...folderHeader(folderId),
      });
      return res.data.value.map((r) => ({
        id: r.Id,
        name: r.Name,
        machineName: r.MachineName,
        username: r.Username,
        type: r.Type,
        description: r.Description,
        isEnabled: r.IsEnabled,
      }));
    },
  },

  {
    name: "create_robot",
    description: "Creates a new robot in a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      name: z.string().describe("Robot name"),
      machineName: z.string().describe("Machine name the robot will run on"),
      username: z.string().describe("Windows username the robot will log in as (e.g. DOMAIN\\user)"),
      type: z
        .enum(["Unattended", "Attended", "NonProduction", "Studio"])
        .describe("Robot type"),
      description: z.string().optional().describe("Optional description"),
    }),
    async handler({
      folderName,
      name,
      machineName,
      username,
      type,
      description,
    }: {
      folderName: string;
      name: string;
      machineName: string;
      username: string;
      type: "Unattended" | "Attended" | "NonProduction" | "Studio";
      description?: string;
    }) {
      const folderId = await resolveFolderId(folderName);
      const body: Partial<RobotDto> = { Name: name, MachineName: machineName, Username: username, Type: type, Description: description };
      const res = await odataClient.post<RobotDto>("Robots", body, folderHeader(folderId));
      return { id: res.data.Id, name: res.data.Name, type: res.data.Type };
    },
  },

  {
    name: "update_robot",
    description: "Updates an existing robot's configuration.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      robotId: z.number().describe("Robot ID"),
      name: z.string().optional().describe("New robot name"),
      machineName: z.string().optional().describe("New machine name"),
      username: z.string().optional().describe("New Windows username"),
      type: z
        .enum(["Unattended", "Attended", "NonProduction", "Studio"])
        .optional()
        .describe("New robot type"),
      description: z.string().optional().describe("New description"),
    }),
    async handler({
      folderName,
      robotId,
      name,
      machineName,
      username,
      type,
      description,
    }: {
      folderName: string;
      robotId: number;
      name?: string;
      machineName?: string;
      username?: string;
      type?: "Unattended" | "Attended" | "NonProduction" | "Studio";
      description?: string;
    }) {
      const folderId = await resolveFolderId(folderName);
      const current = await odataClient.get<RobotDto>(`Robots(${robotId})`, folderHeader(folderId));
      const body: Partial<RobotDto> = {
        ...current.data,
        Name: name ?? current.data.Name,
        MachineName: machineName ?? current.data.MachineName,
        Username: username ?? current.data.Username,
        Type: type ?? current.data.Type,
        Description: description ?? current.data.Description,
      };
      await odataClient.put(`Robots(${robotId})`, body, folderHeader(folderId));
      return { success: true, robotId };
    },
  },

  {
    name: "delete_robot",
    description: "Deletes a robot by its ID.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      robotId: z.number().describe("Robot ID to delete"),
    }),
    async handler({ folderName, robotId }: { folderName: string; robotId: number }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.delete(`Robots(${robotId})`, folderHeader(folderId));
      return { success: true, robotId };
    },
  },

  {
    name: "toggle_robots_enabled",
    description: "Enables or disables one or more robots.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      robotIds: z.array(z.number()).describe("Array of robot IDs to toggle"),
      enabled: z.boolean().describe("True to enable, false to disable"),
    }),
    async handler({
      folderName,
      robotIds,
      enabled,
    }: {
      folderName: string;
      robotIds: number[];
      enabled: boolean;
    }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.post(
        "Robots/UiPath.Server.Configuration.OData.ToggleEnabledStatus",
        { robotIds, enabled },
        folderHeader(folderId)
      );
      return { success: true, robotIds, enabled };
    },
  },
] as const;
