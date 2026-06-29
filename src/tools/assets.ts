import { z } from "zod";
import { odataClient, apiClient, resolveFolderId, folderHeader } from "../client.js";
import type { ODataResponse, AssetDto, UserAssetValueDto } from "../types/orchestrator.js";

export const assetTools = [
  {
    name: "get_asset_by_name",
    description:
      "Gets the value of a named asset. Fastest way to read a single asset value.",
    inputSchema: z.object({
      name: z.string().describe("Asset name (exact)"),
      folderId: z
        .number()
        .optional()
        .describe("Optional folder ID for folder-scoped assets"),
    }),
    async handler({ name, folderId }: { name: string; folderId?: number }) {
      const headers = folderId
        ? { headers: { "X-UIPATH-OrganizationUnitId": folderId } }
        : {};
      const res = await apiClient.get<UserAssetValueDto>(
        `Assets/name/${encodeURIComponent(name)}/value`,
        headers
      );
      return {
        name: res.data.Name,
        valueType: res.data.ValueType,
        stringValue: res.data.StringValue,
        boolValue: res.data.BoolValue,
        intValue: res.data.IntValue,
      };
    },
  },

  {
    name: "get_assets",
    description: "Lists all assets in a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<AssetDto>>("Assets", {
        params: { $top: 500 },
        ...folderHeader(folderId),
      });
      return res.data.value.map((a) => ({
        id: a.Id,
        name: a.Name,
        valueType: a.ValueType,
        description: a.Description,
      }));
    },
  },

  {
    name: "create_asset",
    description: "Creates a new text, integer, or boolean asset in a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      name: z.string().describe("Asset name"),
      valueType: z
        .enum(["Text", "Integer", "Bool", "Credential"])
        .describe("Asset value type"),
      value: z.string().describe("Asset value (as string; booleans: 'true'/'false')"),
      description: z.string().optional().describe("Optional description"),
    }),
    async handler({
      folderName,
      name,
      valueType,
      value,
      description,
    }: {
      folderName: string;
      name: string;
      valueType: "Text" | "Integer" | "Bool" | "Credential";
      value: string;
      description?: string;
    }) {
      const folderId = await resolveFolderId(folderName);
      const body: Partial<AssetDto> = {
        Name: name,
        ValueType: valueType,
        Description: description,
        StringValue: valueType === "Text" ? value : undefined,
        IntValue: valueType === "Integer" ? parseInt(value, 10) : undefined,
        BoolValue: valueType === "Bool" ? value.toLowerCase() === "true" : undefined,
        Value: valueType === "Credential" ? value : undefined,
      };
      const res = await odataClient.post<AssetDto>("Assets", body, folderHeader(folderId));
      return { id: res.data.Id, name: res.data.Name, valueType: res.data.ValueType };
    },
  },

  {
    name: "update_asset",
    description: "Updates the value of an existing asset by its ID.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      assetId: z.number().describe("Asset ID"),
      value: z.string().describe("New value as string"),
    }),
    async handler({ folderName, assetId, value }: { folderName: string; assetId: number; value: string }) {
      const folderId = await resolveFolderId(folderName);
      const current = await odataClient.get<AssetDto>(
        `Assets(${assetId})`,
        folderHeader(folderId)
      );
      const a = current.data;
      const body: Partial<AssetDto> = {
        Name: a.Name,
        ValueType: a.ValueType,
        StringValue: a.ValueType === "Text" ? value : a.StringValue,
        IntValue: a.ValueType === "Integer" ? parseInt(value, 10) : a.IntValue,
        BoolValue: a.ValueType === "Bool" ? value.toLowerCase() === "true" : a.BoolValue,
      };
      await odataClient.put(`Assets(${assetId})`, body, folderHeader(folderId));
      return { success: true, assetId };
    },
  },

  {
    name: "delete_asset",
    description: "Deletes an asset by its ID.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      assetId: z.number().describe("Asset ID to delete"),
    }),
    async handler({ folderName, assetId }: { folderName: string; assetId: number }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.delete(`Assets(${assetId})`, folderHeader(folderId));
      return { success: true, assetId };
    },
  },
] as const;
