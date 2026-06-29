import { z } from "zod";

const configSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  orgName: z.string().min(1),
  tenantName: z.string().min(1),
  identityUrl: z.string().url().default("https://cloud.uipath.com/identity_/"),
  authScope: z
    .string()
    .default(
      "OR.License OR.Robots OR.Machines OR.Execution OR.Assets OR.Queues OR.Jobs OR.Users OR.Folders"
    ),
});

function loadConfig() {
  const result = configSchema.safeParse({
    clientId: process.env.UIPATH_CLIENT_ID,
    clientSecret: process.env.UIPATH_CLIENT_SECRET,
    orgName: process.env.UIPATH_ORG_NAME,
    tenantName: process.env.UIPATH_TENANT_NAME,
    identityUrl: process.env.UIPATH_IDENTITY_URL,
    authScope: process.env.UIPATH_AUTH_SCOPE,
  });

  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing required env vars: ${missing}`);
  }

  return {
    ...result.data,
    orchestratorUrl: `https://cloud.uipath.com/${result.data.orgName}/${result.data.tenantName}/orchestrator_`,
  };
}

export const config = loadConfig();
export type Config = typeof config;
