#!/usr/bin/env node
// Cross-platform stdio launcher for MCP clients (Goose, Claude Code, ...).
//
// Loads any UIPATH_* vars not already set from ../rpa-agent/.env, then imports the server in
// this same process, so stdin/stdout are inherited untouched — no shell, no
// wrapper process, identical on Linux, macOS and Windows.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = process.env.UIPATH_ENV_FILE ?? resolve(root, "..", "rpa-agent", ".env");

if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    // Only UIPATH_*, so the server never inherits the agent's LLM API keys.
    const match = /^\s*(UIPATH_[A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, name] = match;
    // Variables already set in the environment win; .env only fills the gaps.
    if (process.env[name]) continue;
    let value = match[2].trim();
    const quoted = /^'([^']*)'|^"([^"]*)"/.exec(value);
    // Quoted values keep everything inside the quotes; bare ones stop at a trailing # comment.
    value = quoted ? (quoted[1] ?? quoted[2]) : value.split(/\s+#/)[0].trim();
    process.env[name] = value;
  }
}

await import(resolve(root, "dist", "index.js"));
