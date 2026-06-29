import { z } from "zod";
import { odataClient, resolveFolderId, folderHeader } from "../client.js";
import type {
  ODataResponse,
  QueueDefinitionDto,
  QueueItemDto,
  AddQueueItemRequest,
  BulkAddQueueItemsRequest,
} from "../types/orchestrator.js";

export const queueTools = [
  {
    name: "get_queue_definitions",
    description: "Gets all queue definitions in a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
    }),
    async handler({ folderName }: { folderName: string }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<QueueDefinitionDto>>("QueueDefinitions", {
        params: { $top: 500 },
        ...folderHeader(folderId),
      });
      return res.data.value.map((q) => ({
        id: q.Id,
        name: q.Name,
        description: q.Description,
        maxRetries: q.MaxNumberOfRetries,
        acceptAutoRetry: q.AcceptAutomaticallyRetry,
        enforceUniqueRef: q.EnforceUniqueReference,
        processingType: q.ProcessingType,
      }));
    },
  },

  {
    name: "get_queue_items",
    description:
      "Gets items from a queue, optionally filtered by status. Returns up to 100 items.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      queueName: z.string().describe("Queue name to filter items"),
      status: z
        .enum(["New", "InProgress", "Failed", "Successful", "Abandoned", "Retried", "Deleted"])
        .optional()
        .describe("Filter by item status"),
    }),
    async handler({
      folderName,
      queueName,
      status,
    }: {
      folderName: string;
      queueName: string;
      status?: string;
    }) {
      const folderId = await resolveFolderId(folderName);
      const filter = [
        `QueueDefinitionName eq '${queueName}'`,
        status ? `Status eq '${status}'` : null,
      ]
        .filter(Boolean)
        .join(" and ");

      const res = await odataClient.get<ODataResponse<QueueItemDto>>("QueueItems", {
        params: { $top: 100, $filter: filter, $orderby: "CreationTime desc" },
        ...folderHeader(folderId),
      });
      return res.data.value.map((item) => ({
        id: item.Id,
        key: item.Key,
        reference: item.Reference,
        priority: item.Priority,
        status: item.Status,
        creationTime: item.CreationTime,
        startProcessing: item.StartProcessing,
        endProcessing: item.EndProcessing,
        retryNumber: item.RetryNumber,
        progress: item.Progress,
      }));
    },
  },

  {
    name: "add_queue_item",
    description: "Adds a single item to a UiPath queue.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      queueName: z.string().describe("Queue name"),
      priority: z
        .enum(["Low", "Normal", "High"])
        .default("Normal")
        .describe("Item priority"),
      specificContent: z
        .record(z.unknown())
        .optional()
        .describe("Key-value payload attached to the queue item"),
      reference: z.string().optional().describe("Optional unique reference string"),
      deferDate: z.string().optional().describe("ISO 8601 date — do not process before this time"),
      dueDate: z.string().optional().describe("ISO 8601 date — deadline for processing"),
    }),
    async handler({
      folderName,
      queueName,
      priority,
      specificContent,
      reference,
      deferDate,
      dueDate,
    }: {
      folderName: string;
      queueName: string;
      priority: "Low" | "Normal" | "High";
      specificContent?: Record<string, unknown>;
      reference?: string;
      deferDate?: string;
      dueDate?: string;
    }) {
      const folderId = await resolveFolderId(folderName);
      const body: AddQueueItemRequest = {
        itemData: {
          Name: queueName,
          Priority: priority,
          SpecificContent: specificContent,
          Reference: reference,
          DeferDate: deferDate,
          DueDate: dueDate,
        },
      };
      const res = await odataClient.post<QueueItemDto>(
        "Queues/UiPathODataSvc.AddQueueItem",
        body,
        folderHeader(folderId)
      );
      return { id: res.data.Id, key: res.data.Key, status: res.data.Status };
    },
  },

  {
    name: "bulk_add_queue_items",
    description: "Adds multiple items to a queue in a single call.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      queueName: z.string().describe("Queue name"),
      commitType: z
        .enum(["AllOrNothing", "ProcessAllIndependently"])
        .default("ProcessAllIndependently")
        .describe("Commit strategy on failure"),
      items: z
        .array(
          z.object({
            priority: z.enum(["Low", "Normal", "High"]).default("Normal"),
            specificContent: z.record(z.unknown()).optional(),
            reference: z.string().optional(),
            deferDate: z.string().optional(),
            dueDate: z.string().optional(),
          })
        )
        .describe("List of items to add"),
    }),
    async handler({
      folderName,
      queueName,
      commitType,
      items,
    }: {
      folderName: string;
      queueName: string;
      commitType: "AllOrNothing" | "ProcessAllIndependently";
      items: Array<{
        priority: "Low" | "Normal" | "High";
        specificContent?: Record<string, unknown>;
        reference?: string;
        deferDate?: string;
        dueDate?: string;
      }>;
    }) {
      const folderId = await resolveFolderId(folderName);
      const body: BulkAddQueueItemsRequest = {
        queueName,
        commitType,
        queueItems: items.map((i) => ({
          Priority: i.priority,
          SpecificContent: i.specificContent,
          Reference: i.reference,
          DeferDate: i.deferDate,
          DueDate: i.dueDate,
        })),
      };
      const res = await odataClient.post<{ NumberOfItemsCreated?: number }>(
        "Queues/UiPathODataSvc.BulkAddQueueItems",
        body,
        folderHeader(folderId)
      );
      return { itemsCreated: res.data.NumberOfItemsCreated ?? items.length };
    },
  },

  {
    name: "create_queue_definition",
    description: "Creates a new queue in a folder.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      name: z.string().describe("Queue name"),
      description: z.string().optional().describe("Optional description"),
      maxRetries: z
        .number()
        .optional()
        .describe("Maximum number of retries for failed items (0 = no retries)"),
      acceptAutoRetry: z
        .boolean()
        .optional()
        .describe("Automatically retry failed items up to maxRetries times"),
      enforceUniqueReference: z
        .boolean()
        .optional()
        .describe("Reject items with a duplicate Reference value"),
    }),
    async handler({
      folderName,
      name,
      description,
      maxRetries,
      acceptAutoRetry,
      enforceUniqueReference,
    }: {
      folderName: string;
      name: string;
      description?: string;
      maxRetries?: number;
      acceptAutoRetry?: boolean;
      enforceUniqueReference?: boolean;
    }) {
      const folderId = await resolveFolderId(folderName);
      const body: Partial<QueueDefinitionDto> = {
        Name: name,
        Description: description,
        MaxNumberOfRetries: maxRetries,
        AcceptAutomaticallyRetry: acceptAutoRetry,
        EnforceUniqueReference: enforceUniqueReference,
      };
      const res = await odataClient.post<QueueDefinitionDto>(
        "QueueDefinitions",
        body,
        folderHeader(folderId)
      );
      return { id: res.data.Id, name: res.data.Name };
    },
  },

  {
    name: "update_queue_definition",
    description: "Updates an existing queue's configuration.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      queueId: z.number().describe("Queue definition ID"),
      description: z.string().optional().describe("New description"),
      maxRetries: z.number().optional().describe("New max retry count"),
      acceptAutoRetry: z.boolean().optional().describe("New auto-retry setting"),
      enforceUniqueReference: z.boolean().optional().describe("New unique-reference enforcement"),
    }),
    async handler({
      folderName,
      queueId,
      description,
      maxRetries,
      acceptAutoRetry,
      enforceUniqueReference,
    }: {
      folderName: string;
      queueId: number;
      description?: string;
      maxRetries?: number;
      acceptAutoRetry?: boolean;
      enforceUniqueReference?: boolean;
    }) {
      const folderId = await resolveFolderId(folderName);
      const current = await odataClient.get<QueueDefinitionDto>(
        `QueueDefinitions(${queueId})`,
        folderHeader(folderId)
      );
      const body: Partial<QueueDefinitionDto> = {
        ...current.data,
        Description: description ?? current.data.Description,
        MaxNumberOfRetries: maxRetries ?? current.data.MaxNumberOfRetries,
        AcceptAutomaticallyRetry: acceptAutoRetry ?? current.data.AcceptAutomaticallyRetry,
        EnforceUniqueReference: enforceUniqueReference ?? current.data.EnforceUniqueReference,
      };
      await odataClient.put(`QueueDefinitions(${queueId})`, body, folderHeader(folderId));
      return { success: true, queueId };
    },
  },

  {
    name: "delete_queue_definition",
    description: "Deletes a queue definition. The queue must be empty.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      queueId: z.number().describe("Queue definition ID to delete"),
    }),
    async handler({ folderName, queueId }: { folderName: string; queueId: number }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.delete(`QueueDefinitions(${queueId})`, folderHeader(folderId));
      return { success: true, queueId };
    },
  },

  {
    name: "get_queue_item",
    description: "Gets full details of a specific queue item by its ID.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      itemId: z.number().describe("Queue item ID"),
    }),
    async handler({ folderName, itemId }: { folderName: string; itemId: number }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<QueueItemDto>(
        `QueueItems(${itemId})`,
        folderHeader(folderId)
      );
      const item = res.data;
      return {
        id: item.Id,
        key: item.Key,
        reference: item.Reference,
        priority: item.Priority,
        status: item.Status,
        reviewStatus: item.ReviewStatus,
        creationTime: item.CreationTime,
        startProcessing: item.StartProcessing,
        endProcessing: item.EndProcessing,
        retryNumber: item.RetryNumber,
        progress: item.Progress,
        processingExceptionType: item.ProcessingExceptionType,
        specificData: item.SpecificData ? JSON.parse(item.SpecificData) : undefined,
        output: item.Output ? JSON.parse(item.Output) : undefined,
      };
    },
  },

  {
    name: "delete_queue_item",
    description: "Deletes a queue item by its ID.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      itemId: z.number().describe("Queue item ID to delete"),
    }),
    async handler({ folderName, itemId }: { folderName: string; itemId: number }) {
      const folderId = await resolveFolderId(folderName);
      await odataClient.delete(`QueueItems(${itemId})`, folderHeader(folderId));
      return { success: true, itemId };
    },
  },

  {
    name: "get_queue_item_history",
    description: "Gets the full processing history (all retries) of a queue item.",
    inputSchema: z.object({
      folderName: z.string().describe("Folder name (partial match supported)"),
      itemId: z.number().describe("Queue item ID"),
    }),
    async handler({ folderName, itemId }: { folderName: string; itemId: number }) {
      const folderId = await resolveFolderId(folderName);
      const res = await odataClient.get<ODataResponse<QueueItemDto>>(
        `QueueItems(${itemId})/UiPathODataSvc.GetItemProcessingHistory`,
        folderHeader(folderId)
      );
      return res.data.value.map((item) => ({
        id: item.Id,
        status: item.Status,
        startProcessing: item.StartProcessing,
        endProcessing: item.EndProcessing,
        retryNumber: item.RetryNumber,
        processingExceptionType: item.ProcessingExceptionType,
        progress: item.Progress,
      }));
    },
  },
] as const;
