import { z } from "zod";
import { odataClient, getAllFolders, fuzzyMatch, folderHeader, resolveFolderId } from "../client.js";
import { cacheGet, cacheSet } from "../cache.js";
import type { ODataResponse, UserRolesDto, FolderAssignUsersRequest, FolderAssignMachinesRequest } from "../types/orchestrator.js";

export const folderTools = [
  {
    name: "get_all_folders",
    description:
      "Gets all folders in the UiPath Orchestrator tenant. Returns folder names, IDs, parent IDs, and descriptions.",
    inputSchema: z.object({}),
    async handler() {
      const folders = await getAllFolders();
      return folders.map((f) => ({
        id: f.Id,
        name: f.FullyQualifiedName,
        displayName: f.DisplayName,
        description: f.Description,
        parentId: f.ParentId,
      }));
    },
  },

  {
    name: "get_users_in_folder",
    description:
      "Gets all users assigned to a specific folder, including their roles.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<UserRolesDto>>(
        `Folders/UiPath.Server.Configuration.OData.GetUsersForFolder(key=${folderId},includeInherited=true)`,
        { params: { $top: 500 } }
      );
      return res.data.value.map((u) => ({
        id: u.UserEntity.Id,
        userName: u.UserEntity.UserName,
        fullName: u.UserEntity.FullName,
        roles: u.Roles.map((r) => r.Name),
      }));
    },
  },

  {
    name: "get_machine_groups_in_folder",
    description: "Gets all machine groups (templates) assigned to a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<{ value: Array<{ Id: number; Name: string; Description?: string; Type?: string }> }>(
        `Machines/UiPath.Server.Configuration.OData.GetAssignedMachines(folderId=${folderId})`,
        { params: { $top: 500 } }
      );
      return res.data.value
        .filter((m) => m.Type === "Template")
        .map((m) => ({ id: m.Id, name: m.Name, description: m.Description }));
    },
  },

  {
    name: "assign_user_to_folder",
    description:
      "Assigns a user to a folder with a specified role. Requires userId, folderId, and roleId.",
    inputSchema: z.object({
      userId: z.number().describe("User ID"),
      folderId: z.number().describe("Folder ID"),
      roleId: z.number().describe("Role ID to assign"),
    }),
    async handler({ userId, folderId, roleId }: { userId: number; folderId: number; roleId: number }) {
      const body: FolderAssignUsersRequest = {
        assignments: {
          UserIds: [userId],
          RolesPerFolder: [{ FolderId: folderId, RoleIds: [roleId] }],
        },
      };
      await odataClient.post("Folders/UiPath.Server.Configuration.OData.AssignUsers", body);
      return { success: true };
    },
  },

  {
    name: "assign_machine_to_folder",
    description: "Assigns a machine group to a folder.",
    inputSchema: z.object({
      machineId: z.number().describe("Machine ID"),
      folderId: z.number().describe("Folder ID"),
    }),
    async handler({ machineId, folderId }: { machineId: number; folderId: number }) {
      const body: FolderAssignMachinesRequest = {
        assignments: { MachineIds: [machineId], FolderIds: [folderId] },
      };
      await odataClient.post("Folders/UiPath.Server.Configuration.OData.AssignMachines", body);
      return { success: true };
    },
  },

  {
    name: "create_folder",
    description: "Creates a new folder (organization unit) in Orchestrator.",
    inputSchema: z.object({
      displayName: z.string().describe("Display name for the new folder"),
      description: z.string().optional().describe("Optional description"),
      parentFolderName: z
        .string()
        .optional()
        .describe("Parent folder name (partial match). Omit for a top-level folder."),
    }),
    async handler({
      displayName,
      description,
      parentFolderName,
    }: {
      displayName: string;
      description?: string;
      parentFolderName?: string;
    }) {
      const parentId = parentFolderName ? await resolveFolderId(parentFolderName) : undefined;
      const body = { DisplayName: displayName, Description: description, ParentId: parentId };
      const res = await odataClient.post<{ Id: number; Key?: string; DisplayName: string }>(
        "Folders",
        body
      );
      return { id: res.data.Id, key: res.data.Key, displayName: res.data.DisplayName };
    },
  },

  {
    name: "update_folder",
    description:
      "Updates a folder's display name or description. Use get_all_folders to find the folder Key (GUID).",
    inputSchema: z.object({
      folderKey: z.string().describe("Folder GUID key (from get_all_folders)"),
      displayName: z.string().optional().describe("New display name"),
      description: z.string().optional().describe("New description"),
    }),
    async handler({
      folderKey,
      displayName,
      description,
    }: {
      folderKey: string;
      displayName?: string;
      description?: string;
    }) {
      const { apiClient } = await import("../client.js");
      await apiClient.patch("Folders/PatchNameDescription", null, {
        params: {
          key: folderKey,
          ...(displayName !== undefined ? { displayName } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      });
      return { success: true, folderKey };
    },
  },

  {
    name: "delete_folder",
    description:
      "Deletes a folder. Use get_all_folders to find the folder Key (GUID). The folder must be empty.",
    inputSchema: z.object({
      folderKey: z.string().describe("Folder GUID key (from get_all_folders)"),
    }),
    async handler({ folderKey }: { folderKey: string }) {
      const { apiClient } = await import("../client.js");
      await apiClient.delete("Folders/DeleteByKey", { params: { key: folderKey } });
      return { success: true, folderKey };
    },
  },

  {
    name: "remove_user_from_folder",
    description: "Removes a user from a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      userId: z.number().describe("User ID to remove"),
    }),
    async handler({ folderName, userId }: { folderName: string; userId: number }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.post(
        `Folders(${folderId})/UiPath.Server.Configuration.OData.RemoveUserFromFolder`,
        { userId }
      );
      return { success: true, folderId, userId };
    },
  },

  {
    name: "remove_machine_from_folder",
    description: "Removes one or more machines from a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      machineIds: z.array(z.number()).describe("Machine IDs to remove"),
    }),
    async handler({ folderName, machineIds }: { folderName: string; machineIds: number[] }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.post(
        `Folders(${folderId})/UiPath.Server.Configuration.OData.RemoveMachinesFromFolder`,
        { machineIds }
      );
      return { success: true, folderId, machineIds };
    },
  },
] as const;
