import { z } from "zod";
import { odataClient, fuzzyMatch, resolveFolderId } from "../client.js";
import { cacheGet, cacheSet } from "../cache.js";
import type { ODataResponse, MachineDto, MachineSessionDto } from "../types/orchestrator.js";

async function fetchAllMachineGroups(): Promise<MachineDto[]> {
  const cached = cacheGet<MachineDto[]>("machines:all");
  if (cached) return cached;
  const res = await odataClient.get<ODataResponse<MachineDto>>("Machines", {
    params: { $top: 500 },
  });
  cacheSet("machines:all", res.data.value);
  return res.data.value;
}

export const machineTools = [
  {
    name: "get_all_machine_groups",
    description: "Gets all machine groups (templates) in the tenant.",
    inputSchema: z.object({}),
    async handler() {
      const machines = await fetchAllMachineGroups();
      return machines
        .filter((m) => m.Type === "Template")
        .map((m) => ({ id: m.Id, name: m.Name, description: m.Description, type: m.Type }));
    },
  },

  {
    name: "get_machine_group_details",
    description: "Gets details for a specific machine group by name (partial match).",
    inputSchema: z.object({
      machineGroupName: z.string().describe("Machine group name to search for"),
    }),
    async handler({ machineGroupName }: { machineGroupName: string }) {
      const machines = await fetchAllMachineGroups();
      const matches = machines.filter(
        (m) => m.Type === "Template" && fuzzyMatch(m.Name, machineGroupName)
      );
      if (!matches.length) return { error: `No machine group found matching: ${machineGroupName}` };
      return matches.map((m) => ({
        id: m.Id,
        name: m.Name,
        description: m.Description,
        type: m.Type,
        unattendedSlots: m.UnattendedSlots,
        nonProductionSlots: m.NonProductionSlots,
      }));
    },
  },

  {
    name: "get_machines_in_machine_group",
    description:
      "Gets the host machines (sessions) currently registered under a machine group.",
    inputSchema: z.object({
      machineGroupName: z.string().describe("Machine group name (partial match supported)"),
    }),
    async handler({ machineGroupName }: { machineGroupName: string }) {
      const machines = await fetchAllMachineGroups();
      const group = machines.find(
        (m) => m.Type === "Template" && fuzzyMatch(m.Name, machineGroupName)
      );
      if (!group) return { error: `Machine group not found: ${machineGroupName}` };

      const res = await odataClient.get<ODataResponse<MachineSessionDto>>(
        `Sessions/UiPath.Server.Configuration.OData.GetMachineSessions(key=${group.Id})`,
        { params: { $top: 500 } }
      );
      return res.data.value.map((s) => ({
        sessionId: s.SessionId,
        machineId: s.MachineId,
        machineName: s.MachineName,
        hostMachineName: s.HostMachineName,
        state: s.State,
        reportingTime: s.ReportingTime,
        robotUserName: s.RobotUserName,
      }));
    },
  },

  {
    name: "create_machine",
    description: "Creates a new machine template or standard machine in Orchestrator.",
    inputSchema: z.object({
      name: z.string().describe("Machine name"),
      type: z
        .enum(["Template", "Standard"])
        .default("Template")
        .describe("Machine type. Use Template for machine groups (modern folders)."),
      unattendedSlots: z
        .number()
        .optional()
        .describe("Number of unattended runtime slots (Template only)"),
      nonProductionSlots: z
        .number()
        .optional()
        .describe("Number of non-production runtime slots (Template only)"),
      description: z.string().optional().describe("Optional description"),
    }),
    async handler({
      name,
      type,
      unattendedSlots,
      nonProductionSlots,
      description,
    }: {
      name: string;
      type: "Template" | "Standard";
      unattendedSlots?: number;
      nonProductionSlots?: number;
      description?: string;
    }) {
      const body: Partial<MachineDto> = {
        Name: name,
        Type: type,
        UnattendedSlots: unattendedSlots,
        NonProductionSlots: nonProductionSlots,
        Description: description,
      };
      const res = await odataClient.post<MachineDto>("Machines", body);
      return { id: res.data.Id, name: res.data.Name, type: res.data.Type, licenseKey: res.data.LicenseKey };
    },
  },

  {
    name: "update_machine",
    description: "Updates an existing machine's configuration.",
    inputSchema: z.object({
      machineId: z.number().describe("Machine ID"),
      name: z.string().optional().describe("New machine name"),
      unattendedSlots: z.number().optional().describe("New unattended slot count"),
      nonProductionSlots: z.number().optional().describe("New non-production slot count"),
      description: z.string().optional().describe("New description"),
    }),
    async handler({
      machineId,
      name,
      unattendedSlots,
      nonProductionSlots,
      description,
    }: {
      machineId: number;
      name?: string;
      unattendedSlots?: number;
      nonProductionSlots?: number;
      description?: string;
    }) {
      const current = await odataClient.get<MachineDto>(`Machines(${machineId})`);
      const body: Partial<MachineDto> = {
        ...current.data,
        Name: name ?? current.data.Name,
        UnattendedSlots: unattendedSlots ?? current.data.UnattendedSlots,
        NonProductionSlots: nonProductionSlots ?? current.data.NonProductionSlots,
        Description: description ?? current.data.Description,
      };
      await odataClient.put(`Machines(${machineId})`, body);
      return { success: true, machineId };
    },
  },

  {
    name: "delete_machine",
    description: "Deletes a machine by its ID.",
    inputSchema: z.object({
      machineId: z.number().describe("Machine ID to delete"),
    }),
    async handler({ machineId }: { machineId: number }) {
      await odataClient.delete(`Machines(${machineId})`);
      return { success: true, machineId };
    },
  },
] as const;
