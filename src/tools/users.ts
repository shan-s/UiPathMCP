import { z } from "zod";
import { odataClient, fuzzyMatch } from "../client.js";
import { cacheGet, cacheSet } from "../cache.js";
import type { ODataResponse, UserDto, RoleDto } from "../types/orchestrator.js";

async function fetchAllUsers(): Promise<UserDto[]> {
  const cached = cacheGet<UserDto[]>("users:all");
  if (cached) return cached;
  const res = await odataClient.get<ODataResponse<UserDto>>("Users", {
    params: { $top: 500 },
  });
  cacheSet("users:all", res.data.value);
  return res.data.value;
}

async function fetchAllRoles(): Promise<RoleDto[]> {
  const cached = cacheGet<RoleDto[]>("roles:all");
  if (cached) return cached;
  const res = await odataClient.get<ODataResponse<RoleDto>>("Roles", {
    params: { $top: 500 },
  });
  cacheSet("roles:all", res.data.value);
  return res.data.value;
}

export const userTools = [
  {
    name: "get_all_users",
    description: "Gets all users in the tenant.",
    inputSchema: z.object({}),
    async handler() {
      const users = await fetchAllUsers();
      return users.map((u) => ({
        id: u.Id,
        userName: u.UserName,
        fullName: u.FullName,
        isActive: u.IsActive,
        type: u.Type,
      }));
    },
  },

  {
    name: "get_user_details",
    description: "Gets details for a specific user by name (partial match).",
    inputSchema: z.object({
      userName: z.string().describe("Username to search for"),
    }),
    async handler({ userName }: { userName: string }) {
      const users = await fetchAllUsers();
      const matches = users.filter((u) => fuzzyMatch(u.UserName, userName));
      if (!matches.length) return { error: `No user found matching: ${userName}` };
      return matches.map((u) => ({
        id: u.Id,
        userName: u.UserName,
        fullName: u.FullName,
        emailAddress: u.EmailAddress,
        isActive: u.IsActive,
        type: u.Type,
        mayHaveRobotSession: u.MayHaveRobotSession,
        mayHaveUnattended: u.MayHaveUnattended,
      }));
    },
  },

  {
    name: "get_all_roles",
    description: "Gets all roles defined in the tenant.",
    inputSchema: z.object({}),
    async handler() {
      const roles = await fetchAllRoles();
      return roles.map((r) => ({ id: r.Id, name: r.Name, displayName: r.DisplayName }));
    },
  },

  {
    name: "get_role_details",
    description: "Gets details for a specific role by name (partial match).",
    inputSchema: z.object({
      roleName: z.string().describe("Role name to search for"),
    }),
    async handler({ roleName }: { roleName: string }) {
      const roles = await fetchAllRoles();
      const matches = roles.filter((r) => fuzzyMatch(r.Name, roleName));
      if (!matches.length) return { error: `No role found matching: ${roleName}` };
      return matches.map((r) => ({
        id: r.Id,
        name: r.Name,
        displayName: r.DisplayName,
        isStatic: r.IsStatic,
        isEditable: r.IsEditable,
      }));
    },
  },

  {
    name: "get_robots_in_folder",
    description:
      "Gets unattended robots available in a folder (users with robot session capability).",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const { resolveFolderId } = await import("../client.js");
      const folderId = await resolveFolderId(folderName);

      const res = await odataClient.get<{ value: Array<{ UserEntity: UserDto; Roles: RoleDto[] }> }>(
        `Folders/UiPath.Server.Configuration.OData.GetUsersForFolder(key=${folderId},includeInherited=true)`,
        { params: { $top: 500 } }
      );

      const allUsers = await fetchAllUsers();
      const folderUserNames = new Set(res.data.value.map((u) => u.UserEntity.UserName));

      return allUsers
        .filter(
          (u) =>
            u.MayHaveRobotSession &&
            u.MayHaveUnattended &&
            folderUserNames.has(u.UserName)
        )
        .map((u) => ({ id: u.Id, userName: u.UserName, fullName: u.FullName }));
    },
  },

  {
    name: "get_current_user",
    description: "Gets the currently authenticated Orchestrator user and their permissions.",
    inputSchema: z.object({}),
    async handler(_args: Record<string, never>) {
      const res = await odataClient.get<UserDto>(
        "Users/UiPath.Server.Configuration.OData.GetCurrentUser"
      );
      const u = res.data;
      return {
        id: u.Id,
        userName: u.UserName,
        fullName: u.FullName,
        emailAddress: u.EmailAddress,
        isActive: u.IsActive,
        type: u.Type,
      };
    },
  },

  {
    name: "create_user",
    description: "Creates a new Orchestrator user.",
    inputSchema: z.object({
      username: z.string().describe("Login username"),
      name: z.string().describe("First name"),
      surname: z.string().describe("Last name"),
      emailAddress: z.string().optional().describe("Email address"),
      type: z
        .enum(["User", "Robot", "DirectoryUser"])
        .default("User")
        .describe("User type"),
      roleIds: z
        .array(z.number())
        .optional()
        .describe("Role IDs to assign (from get_all_roles)"),
    }),
    async handler({
      username,
      name,
      surname,
      emailAddress,
      type,
      roleIds,
    }: {
      username: string;
      name: string;
      surname: string;
      emailAddress?: string;
      type: "User" | "Robot" | "DirectoryUser";
      roleIds?: number[];
    }) {
      const body: Partial<UserDto> & { RolesList?: number[] } = {
        UserName: username,
        FullName: `${name} ${surname}`,
        EmailAddress: emailAddress,
        Type: type,
        RolesList: roleIds,
      };
      const res = await odataClient.post<UserDto>("Users", body);
      return { id: res.data.Id, userName: res.data.UserName, fullName: res.data.FullName };
    },
  },

  {
    name: "update_user",
    description: "Updates an existing user's profile.",
    inputSchema: z.object({
      userId: z.number().describe("User ID"),
      fullName: z.string().optional().describe("New full name"),
      emailAddress: z.string().optional().describe("New email address"),
      isActive: z.boolean().optional().describe("Enable or disable the user"),
    }),
    async handler({
      userId,
      fullName,
      emailAddress,
      isActive,
    }: {
      userId: number;
      fullName?: string;
      emailAddress?: string;
      isActive?: boolean;
    }) {
      const current = await odataClient.get<UserDto>(`Users(${userId})`);
      const body: Partial<UserDto> = {
        ...current.data,
        FullName: fullName ?? current.data.FullName,
        EmailAddress: emailAddress ?? current.data.EmailAddress,
        IsActive: isActive ?? current.data.IsActive,
      };
      await odataClient.put(`Users(${userId})`, body);
      return { success: true, userId };
    },
  },

  {
    name: "delete_user",
    description: "Deletes a user from the tenant.",
    inputSchema: z.object({
      userId: z.number().describe("User ID to delete"),
    }),
    async handler({ userId }: { userId: number }) {
      await odataClient.delete(`Users(${userId})`);
      return { success: true, userId };
    },
  },

  {
    name: "assign_roles_to_user",
    description: "Assigns one or more roles to an existing user.",
    inputSchema: z.object({
      userId: z.number().describe("User ID"),
      roleIds: z.array(z.number()).describe("Role IDs to assign (from get_all_roles)"),
    }),
    async handler({ userId, roleIds }: { userId: number; roleIds: number[] }) {
      await odataClient.post(
        `Users(${userId})/UiPath.Server.Configuration.OData.AssignRoles`,
        { roleIds }
      );
      return { success: true, userId, roleIds };
    },
  },
] as const;
