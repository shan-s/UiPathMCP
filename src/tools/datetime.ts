import { z } from "zod";

export const datetimeTools = [
  {
    name: "get_current_datetime",
    description: "Gets the current date and time in UTC and local server timezone.",
    inputSchema: z.object({}),
    async handler() {
      const now = new Date();
      return {
        utc: now.toISOString(),
        local: now.toLocaleString(),
        weekDay: now.toLocaleDateString("en-US", { weekday: "long" }),
        dayOfYear: Math.ceil(
          (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
        ),
        utcOffsetMinutes: -now.getTimezoneOffset(),
      };
    },
  },

  {
    name: "get_time_difference",
    description:
      "Calculates the difference between two datetime strings (ISO 8601 format).",
    inputSchema: z.object({
      date1: z.string().describe("First datetime in ISO 8601 format"),
      date2: z.string().describe("Second datetime in ISO 8601 format"),
    }),
    async handler({ date1, date2 }: { date1: string; date2: string }) {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      const diffMs = d2.getTime() - d1.getTime();
      const absDiff = Math.abs(diffMs);
      return {
        days: Math.floor(absDiff / 86400000),
        hours: Math.floor((absDiff % 86400000) / 3600000),
        minutes: Math.floor((absDiff % 3600000) / 60000),
        seconds: Math.floor((absDiff % 60000) / 1000),
        totalSeconds: Math.floor(diffMs / 1000),
        date2IsAfterDate1: diffMs > 0,
      };
    },
  },
] as const;
