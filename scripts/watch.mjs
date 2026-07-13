#!/usr/bin/env node
/**
 * Local watch loop — calls runWatchCycle via the Next.js API.
 * Usage:
 *   npm run watch              # hit local /api/watch every 120s
 *   WATCH_ONCE=1 npm run watch # single run
 *   WATCH_INTERVAL_MS=60000 npm run watch
 *
 * Loads .env.local / .env so CRON_SECRET matches the Next.js server.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const baseUrl = process.env.WATCH_URL ?? "http://127.0.0.1:3000";
const secret = process.env.CRON_SECRET ?? process.env.ADMIN_SECRET ?? "";
const intervalMs = Number(process.env.WATCH_INTERVAL_MS ?? 120_000);
const once = process.env.WATCH_ONCE === "1";

async function tick() {
  const url = new URL("/api/watch", baseUrl);
  if (secret) url.searchParams.set("secret", secret);

  const res = await fetch(url, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
  const body = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }

  if (!res.ok) {
    console.error(`[watch] ${res.status}`, parsed);
    if (res.status === 401) {
      console.error(
        "[watch] Hint: set CRON_SECRET in .env.local (same value as the Next.js server), or pass CRON_SECRET=... on the command line.",
      );
    }
    return;
  }

  console.log(
    `[watch] checked=${parsed.checked} hot=${parsed.hot?.length ?? 0} alerted=${parsed.alerted?.length ?? 0} skippedCooldown=${parsed.skippedCooldown} backend=${parsed.backend}`,
  );
  for (const deal of parsed.hot ?? []) {
    console.log(
      `  HOT +${deal.deltaVotes}/${deal.windowMinutes}m ${deal.votesPos}↑ ${deal.title} ${deal.url}`,
    );
  }
}

async function main() {
  if (!secret) {
    console.warn(
      "[watch] No CRON_SECRET/ADMIN_SECRET loaded — request may 401 if the server has a secret set.",
    );
  } else {
    console.log("[watch] Using CRON_SECRET from env / .env.local");
  }

  console.log(
    `[watch] polling ${baseUrl}/api/watch every ${intervalMs}ms (once=${once})`,
  );
  await tick();
  if (once) return;

  setInterval(() => {
    tick().catch((err) => console.error("[watch] error", err));
  }, intervalMs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
