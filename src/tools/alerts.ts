import { z } from "zod";
import { odataClient } from "../client.js";
import { apiClient } from "../client.js";
import type { ODataResponse, AlertDto, JobsStatsDto } from "../types/orchestrator.js";

export const alertTools = [
  {
    name: "get_alerts",
    description:
      "Gets Orchestrator alerts. Returns up to 50 alerts ordered by creation time descending.",
    inputSchema: z.object({
      severity: z
        .enum(["Info", "Warn", "Error", "Fatal"])
        .optional()
        .describe("Filter by severity"),
      unreadOnly: z.boolean().default(false).describe("Return only unread alerts"),
    }),
    async handler({ severity, unreadOnly }: { severity?: string; unreadOnly: boolean }) {
      const filters: string[] = [];
      if (severity) filters.push(`Severity eq '${severity}'`);
      if (unreadOnly) filters.push(`State eq 'Unread'`);

      const res = await odataClient.get<ODataResponse<AlertDto>>("Alerts", {
        params: {
          $top: 50,
          $orderby: "CreationTime desc",
          ...(filters.length ? { $filter: filters.join(" and ") } : {}),
        },
      });
      return res.data.value.map((a) => ({
        id: a.Id,
        name: a.NotificationName,
        component: a.Component,
        severity: a.Severity,
        state: a.State,
        data: a.Data,
        creationTime: a.CreationTime,
        deepLink: a.DeepLink,
      }));
    },
  },

  {
    name: "get_jobs_stats",
    description:
      "Gets a summary of job counts by state (running, pending, faulted, successful, etc.).",
    inputSchema: z.object({}),
    async handler() {
      const res = await apiClient.get<JobsStatsDto>("Stats/GetJobsStats");
      return res.data;
    },
  },
] as const;
