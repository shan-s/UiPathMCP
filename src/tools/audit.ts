import { z } from "zod";
import { odataClient } from "../client.js";
import type { ODataResponse, AuditLogDto } from "../types/orchestrator.js";

export const auditTools = [
  {
    name: "get_audit_logs",
    description:
      "Retrieves the Orchestrator audit trail. Supports filtering by component, action, or user.",
    inputSchema: z.object({
      top: z.number().optional().default(50).describe("Maximum number of records to return (default 50, max 1000)"),
      component: z
        .enum([
          "Robots",
          "Processes",
          "Jobs",
          "Assets",
          "Queues",
          "Schedules",
          "Users",
          "Folders",
          "Machines",
          "Webhooks",
          "Settings",
        ])
        .optional()
        .describe("Filter by Orchestrator component"),
      filter: z
        .string()
        .optional()
        .describe("OData $filter expression, e.g. \"UserName eq 'admin'\""),
    }),
    async handler({
      top,
      component,
      filter,
    }: {
      top?: number;
      component?: string;
      filter?: string;
    }) {
      const parts: string[] = [];
      if (component) parts.push(`Component eq '${component}'`);
      if (filter) parts.push(filter);
      const $filter = parts.length > 0 ? parts.join(" and ") : undefined;

      const res = await odataClient.get<ODataResponse<AuditLogDto>>("AuditLogs", {
        params: {
          $top: top ?? 50,
          $orderby: "ExecutionTime desc",
          ...$filter ? { $filter } : {},
        },
      });
      return res.data.value.map((a) => ({
        id: a.Id,
        userName: a.UserName,
        action: a.Action,
        operationText: a.OperationText,
        entityId: a.EntityId,
        entityType: a.EntityType,
        component: a.Component,
        serviceName: a.ServiceName,
        timeStamp: a.TimeStamp,
      }));
    },
  },
] as const;
