import { z } from "zod";
import { odataClient, fuzzyMatch, resolveFolderId, folderHeader } from "../client.js";
import { cacheGet, cacheSet } from "../cache.js";
import type { ODataResponse, ProcessDto, ReleaseDto } from "../types/orchestrator.js";

async function fetchAllPackages(): Promise<ProcessDto[]> {
  const cached = cacheGet<ProcessDto[]>("packages:all");
  if (cached) return cached;
  const res = await odataClient.get<ODataResponse<ProcessDto>>("Processes", {
    params: { $top: 500 },
  });
  cacheSet("packages:all", res.data.value);
  return res.data.value;
}

export const processTools = [
  {
    name: "get_all_packages",
    description: "Gets all automation packages (NuGet packages) available in the tenant.",
    inputSchema: z.object({}),
    async handler() {
      const packages = await fetchAllPackages();
      return packages.map((p) => ({
        id: p.Id,
        title: p.Title,
        version: p.Version,
        isLatestVersion: p.IsLatestVersion,
        description: p.Description,
      }));
    },
  },

  {
    name: "get_package_details",
    description:
      "Gets all versions of a specific package by name (partial match).",
    inputSchema: z.object({
      packageName: z.string().describe("Package name to search for"),
    }),
    async handler({ packageName }: { packageName: string }) {
      const packages = await fetchAllPackages();
      const match = packages.find((p) => p.Id && fuzzyMatch(p.Id, packageName));
      if (!match) return { error: `Package not found: ${packageName}` };

      const res = await odataClient.get<ODataResponse<ProcessDto>>(
        `Processes/UiPath.Server.Configuration.OData.GetProcessVersions(processId='${encodeURIComponent(match.Id)}')`,
        { params: { $top: 100 } }
      );
      return res.data.value.map((p) => ({
        id: p.Id,
        title: p.Title,
        version: p.Version,
        isLatestVersion: p.IsLatestVersion,
        published: p.Published,
        authors: p.Authors,
        description: p.Description,
      }));
    },
  },

  {
    name: "get_processes_in_folder",
    description:
      "Gets all processes (releases) deployed in a specific folder. A process is a package version deployed to a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<ReleaseDto>>("Releases", {
        params: { $top: 500 },
        ...folderHeader(folderId),
      });
      return res.data.value
        .filter((p) => !p.IsProcessDeleted)
        .map((p) => ({
          id: p.Id,
          key: p.Key,
          name: p.Name,
          description: p.Description,
          version: p.ProcessVersion,
          isLatestVersion: p.IsLatestVersion,
          isAttended: p.IsAttended,
        }));
    },
  },

  {
    name: "get_process_details",
    description:
      "Gets details of a specific process in a folder by process name (partial match).",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      processName: z.string().describe("Process name to search for"),
    }),
    async handler({ folderName, processName }: { folderName: string; processName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<ReleaseDto>>("Releases", {
        params: { $top: 500 },
        ...folderHeader(folderId),
      });
      const matches = res.data.value.filter(
        (p) => !p.IsProcessDeleted && fuzzyMatch(p.Name, processName)
      );
      if (!matches.length) return { error: `Process not found: ${processName} in folder: ${folderName}` };
      return matches.map((p) => ({
        id: p.Id,
        key: p.Key,
        name: p.Name,
        description: p.Description,
        version: p.ProcessVersion,
        isLatestVersion: p.IsLatestVersion,
        isAttended: p.IsAttended,
        releaseName: p.ReleaseName,
        environmentName: p.EnvironmentName,
      }));
    },
  },
] as const;
