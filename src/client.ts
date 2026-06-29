import axios, { type AxiosInstance } from "axios";
import { getAccessToken } from "./auth.js";
import { config } from "./config.js";
import { cacheGet, cacheSet } from "./cache.js";
import type { FolderDto } from "./types/orchestrator.js";

function makeClient(baseURL: string): AxiosInstance {
  const instance = axios.create({ baseURL });

  instance.interceptors.request.use(async (req) => {
    const token = await getAccessToken();
    req.headers.Authorization = `Bearer ${token}`;
    return req;
  });

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      const status: number | undefined = err.response?.status;
      const data = err.response?.data;

      let detail: string;
      if (data == null) {
        detail = err.message;
      } else if (typeof data === "string") {
        detail = data;
      } else {
        // OData error envelope
        const odataMsg = data["@odata.error"]?.message?.value ?? data["@odata.error"]?.message;
        // RFC 7807 / ASP.NET problem details
        const problemDetail = data.detail ?? data.title;
        // Validation error map  { errors: { field: ["msg"] } }
        const validationErrors = data.errors
          ? JSON.stringify(data.errors)
          : undefined;
        // Plain message field
        const message = data.message;

        detail = odataMsg ?? validationErrors ?? problemDetail ?? message ?? JSON.stringify(data);
      }

      throw new Error(`UiPath API error ${status ?? ""}: ${detail}`.trimEnd());
    }
  );

  return instance;
}

export const odataClient = makeClient(`${config.orchestratorUrl}/odata/`);
export const apiClient = makeClient(`${config.orchestratorUrl}/api/`);

/** Attach folder header to a request config. */
export function folderHeader(folderId: number) {
  return { headers: { "X-UIPATH-OrganizationUnitId": folderId } };
}

/** Resolve folder name → numeric ID, with caching. */
export async function resolveFolderId(folderName: string): Promise<number> {
  const cacheKey = `folder:${folderName.toLowerCase()}`;
  const cached = cacheGet<number>(cacheKey);
  if (cached !== undefined) return cached;

  const folders = await getAllFolders();
  const match = folders.find(
    (f) =>
      fuzzyMatch(f.FullyQualifiedName, folderName) ||
      fuzzyMatch(f.DisplayName, folderName)
  );
  if (!match?.Id) throw new Error(`Folder not found: ${folderName}`);
  cacheSet(cacheKey, match.Id);
  return match.Id;
}

/** Case-insensitive contains match (mirrors C# IsMatchOf). */
export function fuzzyMatch(source: string, term: string): boolean {
  return source.toLowerCase().includes(term.toLowerCase());
}

/** Fetch all folders (cached). */
export async function getAllFolders(): Promise<FolderDto[]> {
  const cached = cacheGet<FolderDto[]>("folders:all");
  if (cached) return cached;

  const res = await odataClient.get<{ value: FolderDto[] }>("Folders", {
    params: { $top: 500 },
  });
  const folders = res.data.value;
  cacheSet("folders:all", folders);
  return folders;
}
