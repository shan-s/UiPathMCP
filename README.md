# UiPath Orchestrator MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that exposes UiPath Orchestrator (Automation Cloud) as tools for LLM agents and MCP clients such as Claude Code and Goose.

The server provides 82 tools covering folders, processes, releases, jobs, queues, assets, robots, machines, schedules, users, webhooks, sessions, logs and alerts. It runs over **stdio**.

## Requirements

- Node.js 18 or later
- A UiPath Automation Cloud **External Application** (confidential client) with client credentials and the Orchestrator scopes your tools need

## Setup

```bash
npm install
npm run build
```

### Configuration

All configuration is read from environment variables:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `UIPATH_CLIENT_ID` | yes | | External application client ID |
| `UIPATH_CLIENT_SECRET` | yes | | External application client secret |
| `UIPATH_ORG_NAME` | yes | | Organization name, as it appears in the cloud URL |
| `UIPATH_TENANT_NAME` | yes | | Tenant name |
| `UIPATH_IDENTITY_URL` | no | `https://cloud.uipath.com/identity_/` | Identity server base URL (keep the trailing slash) |
| `UIPATH_AUTH_SCOPE` | no | `OR.License OR.Robots OR.Machines OR.Execution OR.Assets OR.Queues OR.Jobs OR.Users OR.Folders` | Space-separated OAuth scopes to request |
| `UIPATH_ENV_FILE` | no | `../rpa-agent/.env` | `.env` file read by the `bin/stdio.mjs` launcher |

The Orchestrator base URL is derived as `https://cloud.uipath.com/<org>/<tenant>/orchestrator_`.

> The default scope does not include every scope some tools need, for example webhooks, audit logs and alerts. If those tools return 401 or 403 errors, add the matching scopes to both the external application and `UIPATH_AUTH_SCOPE`.

## Running

```bash
npm start          # compiled: node dist/index.js
npm run dev        # from source via tsx
```

The server speaks MCP over stdin/stdout. Logs go to stderr.

## Connecting an MCP client

### Using the stdio launcher

`bin/stdio.mjs` is a cross-platform launcher. It loads only the `UIPATH_*` variables from `../rpa-agent/.env`, or from the file named by `UIPATH_ENV_FILE`, so the server never inherits the agent's LLM API keys. Variables already set in the environment, such as Windows user or system variables, take priority, and the `.env` file only fills in the ones that are missing. It then imports `dist/index.js` in the same process. Run `npm run build` first.

Claude Code:

```bash
claude mcp add uipath -- node /absolute/path/to/UiPathMCP/bin/stdio.mjs
```

Generic `mcpServers` JSON config:

```json
{
  "mcpServers": {
    "uipath": {
      "command": "node",
      "args": ["/absolute/path/to/UiPathMCP/bin/stdio.mjs"]
    }
  }
}
```

## Tools

Most folder-scoped tools take a folder **name** rather than an ID. Names are resolved to IDs by a case-insensitive substring match on the folder's display name or fully qualified name, and the first match wins. Lookups are cached in memory for 5 minutes.

| Area | Tools |
| --- | --- |
| Folders | `get_all_folders`, `create_folder`, `update_folder`, `delete_folder`, `get_users_in_folder`, `assign_user_to_folder`, `remove_user_from_folder`, `get_machine_groups_in_folder`, `assign_machine_to_folder`, `remove_machine_from_folder` |
| Packages & processes | `get_all_packages`, `get_package_details`, `get_processes_in_folder`, `get_process_details` |
| Releases | `get_releases`, `get_release_details`, `create_release`, `delete_release`, `update_release_to_latest`, `update_release_to_version`, `rollback_release` |
| Jobs | `get_jobs_in_folder`, `get_job_details`, `execute_process`, `stop_job`, `restart_job`, `resume_job`, `bulk_stop_jobs` |
| Queues | `get_queue_definitions`, `create_queue_definition`, `update_queue_definition`, `delete_queue_definition`, `get_queue_items`, `get_queue_item`, `add_queue_item`, `bulk_add_queue_items`, `delete_queue_item`, `get_queue_item_history` |
| Assets | `get_assets`, `get_asset_by_name`, `create_asset`, `update_asset`, `delete_asset` |
| Robots | `get_all_robots`, `create_robot`, `update_robot`, `delete_robot`, `toggle_robots_enabled` |
| Machines | `get_all_machine_groups`, `get_machine_group_details`, `get_machines_in_machine_group`, `create_machine`, `update_machine`, `delete_machine` |
| Schedules | `get_triggers_in_folder`, `create_schedule`, `update_schedule`, `delete_schedule`, `enable_disable_schedule` |
| Users & roles | `get_all_users`, `get_user_details`, `get_current_user`, `create_user`, `update_user`, `delete_user`, `get_all_roles`, `get_role_details`, `assign_roles_to_user`, `get_robots_in_folder` |
| Sessions | `get_sessions`, `get_machine_sessions`, `get_global_sessions` |
| Webhooks | `get_webhooks`, `create_webhook`, `update_webhook`, `delete_webhook` |
| Monitoring | `get_robot_logs`, `get_audit_logs`, `get_alerts`, `get_jobs_stats` |
| Utilities | `get_current_datetime`, `get_time_difference` |

Every tool returns its result as pretty-printed JSON text. Failures are returned as `Error: <message>` with `isError: true` rather than as protocol errors, so the calling model can see and react to them.

> Many of these tools are destructive, such as the `delete_*`, `stop_job` and `bulk_stop_jobs` tools. Review the client's tool permissions before you point an autonomous agent at a production tenant.

## Project layout

```
src/
  index.ts          server entry: tool registration, stdio transport
  config.ts         env var parsing and validation (zod)
  auth.ts           client-credentials token fetch and refresh
  client.ts         axios client, folder header, folder-name resolution
  cache.ts          in-memory TTL cache (5 min)
  tools/*.ts        one module per Orchestrator area
  types/            Orchestrator response types
bin/stdio.mjs       stdio launcher that loads UIPATH_* from a .env file
```

Access tokens are cached and refreshed 30 seconds before they expire.

## License

MIT. See [LICENSE](../LICENSE).
