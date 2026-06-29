import { z } from "zod";
import { odataClient, resolveFolderId, folderHeader } from "../client.js";
import type { ODataResponse, ReleaseDto, ReleaseExtendedDto } from "../types/orchestrator.js";

export const releaseTools = [
  {
    name: "get_releases",
    description: "Lists all process releases (deployments) in a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<ReleaseExtendedDto>>("Releases", {
        params: { $top: 500, $orderby: "Name asc" },
        ...folderHeader(folderId),
      });
      return res.data.value.map((r) => ({
        id: r.Id,
        key: r.Key,
        name: r.Name,
        processKey: r.ProcessKey,
        processVersion: r.ProcessVersion,
        isLatestVersion: r.IsLatestVersion,
        isAttended: r.IsAttended,
        description: r.Description,
        entryPointPath: r.EntryPointPath,
      }));
    },
  },

  {
    name: "get_release_details",
    description: "Gets full details of a specific release by its numeric ID.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      releaseId: z.number().describe("Release ID"),
    }),
    async handler({ folderName, releaseId }: { folderName: string; releaseId: number }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ReleaseExtendedDto>(
        `Releases(${releaseId})`,
        folderHeader(folderId)
      );
      const r = res.data;
      return {
        id: r.Id,
        key: r.Key,
        name: r.Name,
        processKey: r.ProcessKey,
        processVersion: r.ProcessVersion,
        isLatestVersion: r.IsLatestVersion,
        isAttended: r.IsAttended,
        description: r.Description,
        entryPointPath: r.EntryPointPath,
        autoUpdate: r.AutoUpdate,
        arguments: r.Arguments,
      };
    },
  },

  {
    name: "create_release",
    description:
      "Creates a new process release (deploys a package to a folder). Use get_package_details to obtain the processKey.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      name: z.string().describe("Release name (display name shown in Orchestrator)"),
      processKey: z.string().describe("Package process key, e.g. 'MyProcess:1.0.0'"),
      description: z.string().optional().describe("Optional description"),
    }),
    async handler({
      folderName,
      name,
      processKey,
      description,
    }: {
      folderName: string;
      name: string;
      processKey: string;
      description?: string;
    }) {
      const folderId = await resolveFolderId(folderName);
      const body: Partial<ReleaseDto> & { ProcessKey?: string } = {
        Name: name,
        ProcessKey: processKey,
        Description: description,
      };
      const res = await odataClient.post<ReleaseExtendedDto>(
        "Releases",
        body,
        folderHeader(folderId)
      );
      return {
        id: res.data.Id,
        key: res.data.Key,
        name: res.data.Name,
        processVersion: res.data.ProcessVersion,
      };
    },
  },

  {
    name: "delete_release",
    description: "Deletes a process release from a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      releaseId: z.number().describe("Release ID to delete"),
    }),
    async handler({ folderName, releaseId }: { folderName: string; releaseId: number }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.delete(`Releases(${releaseId})`, folderHeader(folderId));
      return { success: true, releaseId };
    },
  },

  {
    name: "update_release_to_latest",
    description: "Updates a release to the latest available version of its package.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      releaseId: z.number().describe("Release ID"),
    }),
    async handler({ folderName, releaseId }: { folderName: string; releaseId: number }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.post<ReleaseExtendedDto>(
        `Releases(${releaseId})/UiPath.Server.Configuration.OData.UpdateToLatestPackageVersion`,
        {},
        folderHeader(folderId)
      );
      return {
        success: true,
        releaseId,
        processVersion: res.data?.ProcessVersion,
        isLatestVersion: res.data?.IsLatestVersion,
      };
    },
  },

  {
    name: "update_release_to_version",
    description: "Updates a release to a specific package version.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      releaseId: z.number().describe("Release ID"),
      version: z.string().describe("Target version string, e.g. '2.1.0'"),
    }),
    async handler({
      folderName,
      releaseId,
      version,
    }: {
      folderName: string;
      releaseId: number;
      version: string;
    }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.post(
        `Releases(${releaseId})/UiPath.Server.Configuration.OData.UpdateToSpecificPackageVersion`,
        { packageVersion: version },
        folderHeader(folderId)
      );
      return { success: true, releaseId, version };
    },
  },

  {
    name: "rollback_release",
    description: "Rolls back a release to the previous package version.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      releaseId: z.number().describe("Release ID"),
    }),
    async handler({ folderName, releaseId }: { folderName: string; releaseId: number }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.post(
        `Releases(${releaseId})/UiPath.Server.Configuration.OData.RollbackToPreviousReleaseVersion`,
        {},
        folderHeader(folderId)
      );
      return { success: true, releaseId };
    },
  },
] as const;
