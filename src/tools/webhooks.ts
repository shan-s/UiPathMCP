import { z } from "zod";
import { odataClient } from "../client.js";
import type { ODataResponse, WebhookDto } from "../types/orchestrator.js";

export const webhookTools = [
  {
    name: "get_webhooks",
    description: "Lists all registered webhooks in the tenant.",
    inputSchema: z.object({}),
    async handler(_args: Record<string, never>) {
      const res = await odataClient.get<ODataResponse<WebhookDto>>("Webhooks", {
        params: { $top: 200 },
      });
      return res.data.value.map((w) => ({
        id: w.Id,
        name: w.Name,
        url: w.Url,
        enabled: w.Enabled,
        allowInsecureSsl: w.AllowInsecureSsl,
        subscribeToAllEvents: w.SubscribeToAllEvents,
        events: w.Events?.map((e) => e.EventType),
      }));
    },
  },

  {
    name: "create_webhook",
    description: "Creates a new webhook to receive Orchestrator event notifications.",
    inputSchema: z.object({
      url: z.string().describe("HTTPS URL that will receive POST notifications"),
      enabled: z.boolean().default(true).describe("Whether the webhook is active"),
      secret: z.string().optional().describe("Optional HMAC signing secret"),
      allowInsecureSsl: z
        .boolean()
        .default(false)
        .describe("Allow unverified SSL certificates on the target URL"),
      subscribeToAllEvents: z
        .boolean()
        .default(false)
        .describe("Subscribe to every event type (ignores the events list when true)"),
      events: z
        .array(z.string())
        .optional()
        .describe(
          "Event types to subscribe to, e.g. ['job.started','job.faulted','queue.item.added']"
        ),
    }),
    async handler({
      url,
      enabled,
      secret,
      allowInsecureSsl,
      subscribeToAllEvents,
      events,
    }: {
      url: string;
      enabled: boolean;
      secret?: string;
      allowInsecureSsl: boolean;
      subscribeToAllEvents: boolean;
      events?: string[];
    }) {
      const body: Partial<WebhookDto> = {
        Url: url,
        Enabled: enabled,
        Secret: secret,
        AllowInsecureSsl: allowInsecureSsl,
        SubscribeToAllEvents: subscribeToAllEvents,
        Events: events?.map((e) => ({ EventType: e })),
      };
      const res = await odataClient.post<WebhookDto>("Webhooks", body);
      return { id: res.data.Id, url: res.data.Url, enabled: res.data.Enabled };
    },
  },

  {
    name: "update_webhook",
    description: "Updates an existing webhook's configuration.",
    inputSchema: z.object({
      webhookId: z.number().describe("Webhook ID"),
      url: z.string().optional().describe("New target URL"),
      enabled: z.boolean().optional().describe("Enable or disable the webhook"),
      secret: z.string().optional().describe("New HMAC signing secret"),
      allowInsecureSsl: z.boolean().optional().describe("Allow unverified SSL"),
      subscribeToAllEvents: z.boolean().optional().describe("Subscribe to all events"),
      events: z.array(z.string()).optional().describe("New list of event types"),
    }),
    async handler({
      webhookId,
      url,
      enabled,
      secret,
      allowInsecureSsl,
      subscribeToAllEvents,
      events,
    }: {
      webhookId: number;
      url?: string;
      enabled?: boolean;
      secret?: string;
      allowInsecureSsl?: boolean;
      subscribeToAllEvents?: boolean;
      events?: string[];
    }) {
      const current = await odataClient.get<WebhookDto>(`Webhooks(${webhookId})`);
      const body: Partial<WebhookDto> = {
        ...current.data,
        Url: url ?? current.data.Url,
        Enabled: enabled ?? current.data.Enabled,
        Secret: secret ?? current.data.Secret,
        AllowInsecureSsl: allowInsecureSsl ?? current.data.AllowInsecureSsl,
        SubscribeToAllEvents: subscribeToAllEvents ?? current.data.SubscribeToAllEvents,
        Events: events ? events.map((e) => ({ EventType: e })) : current.data.Events,
      };
      await odataClient.put(`Webhooks(${webhookId})`, body);
      return { success: true, webhookId };
    },
  },

  {
    name: "delete_webhook",
    description: "Deletes a webhook by its ID.",
    inputSchema: z.object({
      webhookId: z.number().describe("Webhook ID to delete"),
    }),
    async handler({ webhookId }: { webhookId: number }) {
      await odataClient.delete(`Webhooks(${webhookId})`);
      return { success: true, webhookId };
    },
  },
] as const;
