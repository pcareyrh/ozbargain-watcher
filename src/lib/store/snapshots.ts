import type { ConfigOverrides, WatcherConfig } from "../config";
import {
  CONFIG_REDIS_KEY,
  configFromEnv,
  mergeConfig,
} from "../config";
import type { Deal } from "../ozbargain/types";
import { getRedis, isRedisConfigured } from "./redis";

export type VoteSample = {
  at: number;
  votesPos: number;
};

export type DealSnapshot = {
  id: string;
  title: string;
  url: string;
  categorySlug: string | null;
  history: VoteSample[];
  updatedAt: number;
};

export type StoredAlert = {
  dealId: string;
  title: string;
  url: string;
  categorySlug: string | null;
  deltaVotes: number;
  windowMinutes: number;
  votesPos: number;
  alertedAt: number;
};

const DEAL_TTL_SECONDS = 48 * 60 * 60;
const RECENT_ALERTS_KEY = "alerts:recent";
const LAST_RUN_KEY = "watch:lastRun";
const MAX_RECENT_ALERTS = 50;

/** In-memory fallback when Redis is not configured (local DX). */
const memory = {
  deals: new Map<string, DealSnapshot>(),
  alerted: new Map<string, number>(),
  recentAlerts: [] as StoredAlert[],
  configOverrides: null as ConfigOverrides | null,
  lastRun: null as number | null,
};

function dealKey(id: string): string {
  return `deal:${id}`;
}

function alertedKey(id: string): string {
  return `alerted:${id}`;
}

function trimHistory(
  history: VoteSample[],
  windowMinutes: number,
  now: number,
): VoteSample[] {
  const cutoff = now - (windowMinutes + 15) * 60 * 1000;
  return history.filter((s) => s.at >= cutoff).sort((a, b) => a.at - b.at);
}

export async function loadConfig(): Promise<WatcherConfig> {
  const base = configFromEnv();
  const redis = getRedis();

  if (!redis) {
    return mergeConfig(base, memory.configOverrides);
  }

  const overrides = await redis.get<ConfigOverrides>(CONFIG_REDIS_KEY);
  return mergeConfig(base, overrides ?? null);
}

export async function getConfigOverrides(): Promise<ConfigOverrides | null> {
  const redis = getRedis();
  if (!redis) return memory.configOverrides;
  return (await redis.get<ConfigOverrides>(CONFIG_REDIS_KEY)) ?? null;
}

export async function saveConfigOverrides(
  overrides: ConfigOverrides,
): Promise<WatcherConfig> {
  const redis = getRedis();
  if (!redis) {
    memory.configOverrides = {
      ...(memory.configOverrides ?? {}),
      ...overrides,
      categoryAllowlist:
        overrides.categoryAllowlist ??
        memory.configOverrides?.categoryAllowlist,
    };
    return loadConfig();
  }

  const existing = (await redis.get<ConfigOverrides>(CONFIG_REDIS_KEY)) ?? {};
  const merged: ConfigOverrides = {
    ...existing,
    ...overrides,
  };
  if (overrides.categoryAllowlist !== undefined) {
    merged.categoryAllowlist = overrides.categoryAllowlist;
  }
  await redis.set(CONFIG_REDIS_KEY, merged);
  return loadConfig();
}

export async function clearConfigOverrides(): Promise<WatcherConfig> {
  const redis = getRedis();
  if (!redis) {
    memory.configOverrides = null;
    return loadConfig();
  }
  await redis.del(CONFIG_REDIS_KEY);
  return loadConfig();
}

export async function getDealSnapshot(id: string): Promise<DealSnapshot | null> {
  const redis = getRedis();
  if (!redis) return memory.deals.get(id) ?? null;
  return (await redis.get<DealSnapshot>(dealKey(id))) ?? null;
}

export async function upsertDealHistory(
  deal: Deal,
  windowMinutes: number,
  now = Date.now(),
): Promise<DealSnapshot> {
  const existing = await getDealSnapshot(deal.id);
  const history = trimHistory(
    [...(existing?.history ?? []), { at: now, votesPos: deal.votesPos }],
    windowMinutes,
    now,
  );

  const snapshot: DealSnapshot = {
    id: deal.id,
    title: deal.title,
    url: deal.url,
    categorySlug: deal.categorySlug,
    history,
    updatedAt: now,
  };

  const redis = getRedis();
  if (!redis) {
    memory.deals.set(deal.id, snapshot);
    return snapshot;
  }

  await redis.set(dealKey(deal.id), snapshot, { ex: DEAL_TTL_SECONDS });
  return snapshot;
}

export async function wasRecentlyAlerted(
  dealId: string,
  cooldownHours: number,
  now = Date.now(),
): Promise<boolean> {
  const redis = getRedis();
  let alertedAt: number | null = null;

  if (!redis) {
    alertedAt = memory.alerted.get(dealId) ?? null;
  } else {
    alertedAt = (await redis.get<number>(alertedKey(dealId))) ?? null;
  }

  if (alertedAt === null) return false;
  return now - alertedAt < cooldownHours * 60 * 60 * 1000;
}

export async function markAlerted(
  dealId: string,
  cooldownHours: number,
  now = Date.now(),
): Promise<void> {
  const redis = getRedis();
  const ttlSeconds = Math.ceil(cooldownHours * 60 * 60);

  if (!redis) {
    memory.alerted.set(dealId, now);
    return;
  }

  await redis.set(alertedKey(dealId), now, { ex: ttlSeconds });
}

export async function pushRecentAlert(alert: StoredAlert): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory.recentAlerts.unshift(alert);
    memory.recentAlerts = memory.recentAlerts.slice(0, MAX_RECENT_ALERTS);
    return;
  }

  await redis.lpush(RECENT_ALERTS_KEY, JSON.stringify(alert));
  await redis.ltrim(RECENT_ALERTS_KEY, 0, MAX_RECENT_ALERTS - 1);
}

export async function getRecentAlerts(limit = 20): Promise<StoredAlert[]> {
  const redis = getRedis();
  if (!redis) return memory.recentAlerts.slice(0, limit);

  const raw = await redis.lrange<string>(RECENT_ALERTS_KEY, 0, limit - 1);
  return raw.map((item) => {
    if (typeof item === "string") return JSON.parse(item) as StoredAlert;
    return item as unknown as StoredAlert;
  });
}

export async function setLastRun(at = Date.now()): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memory.lastRun = at;
    return;
  }
  await redis.set(LAST_RUN_KEY, at);
}

export async function getLastRun(): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return memory.lastRun;
  return (await redis.get<number>(LAST_RUN_KEY)) ?? null;
}

export async function pingStore(): Promise<{
  ok: boolean;
  backend: "redis" | "memory";
}> {
  if (!isRedisConfigured()) {
    return { ok: true, backend: "memory" };
  }
  const redis = getRedis();
  if (!redis) return { ok: false, backend: "redis" };
  try {
    const pong = await redis.ping();
    return { ok: pong === "PONG", backend: "redis" };
  } catch {
    return { ok: false, backend: "redis" };
  }
}
