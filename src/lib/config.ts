import { isKnownCategorySlug } from "./ozbargain/categories";

export type AlertConfig = {
  voteDelta: number;
  windowMinutes: number;
  cooldownHours: number;
};

export type WatcherConfig = AlertConfig & {
  categoryAllowlist: string[];
};

export type ConfigOverrides = {
  voteDelta?: number;
  windowMinutes?: number;
  cooldownHours?: number;
  categoryAllowlist?: string[];
};

export const DEFAULT_CONFIG: WatcherConfig = {
  voteDelta: 15,
  windowMinutes: 45,
  cooldownHours: 6,
  categoryAllowlist: [],
};

const CONFIG_REDIS_KEY = "config:alerts";

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function parseAllowlistFromEnv(value: string | undefined): string[] {
  if (!value || value.trim() === "") return [];
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function configFromEnv(): WatcherConfig {
  return {
    voteDelta: parsePositiveNumber(
      process.env.ALERT_VOTE_DELTA,
      DEFAULT_CONFIG.voteDelta,
    ),
    windowMinutes: parsePositiveNumber(
      process.env.ALERT_WINDOW_MINUTES,
      DEFAULT_CONFIG.windowMinutes,
    ),
    cooldownHours: parsePositiveNumber(
      process.env.ALERT_COOLDOWN_HOURS,
      DEFAULT_CONFIG.cooldownHours,
    ),
    categoryAllowlist: parseAllowlistFromEnv(process.env.CATEGORY_ALLOWLIST),
  };
}

export function mergeConfig(
  base: WatcherConfig,
  overrides: ConfigOverrides | null | undefined,
): WatcherConfig {
  if (!overrides) return { ...base, categoryAllowlist: [...base.categoryAllowlist] };

  return {
    voteDelta:
      overrides.voteDelta !== undefined ? overrides.voteDelta : base.voteDelta,
    windowMinutes:
      overrides.windowMinutes !== undefined
        ? overrides.windowMinutes
        : base.windowMinutes,
    cooldownHours:
      overrides.cooldownHours !== undefined
        ? overrides.cooldownHours
        : base.cooldownHours,
    categoryAllowlist:
      overrides.categoryAllowlist !== undefined
        ? [...overrides.categoryAllowlist]
        : [...base.categoryAllowlist],
  };
}

export function validateConfigOverrides(input: unknown): {
  ok: true;
  value: ConfigOverrides;
} | { ok: false; error: string } {
  if (input === null || typeof input !== "object") {
    return { ok: false, error: "Body must be a JSON object" };
  }

  const body = input as Record<string, unknown>;
  const value: ConfigOverrides = {};

  for (const key of ["voteDelta", "windowMinutes", "cooldownHours"] as const) {
    if (body[key] === undefined) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: `${key} must be a positive number` };
    }
    value[key] = n;
  }

  if (body.categoryAllowlist !== undefined) {
    if (!Array.isArray(body.categoryAllowlist)) {
      return { ok: false, error: "categoryAllowlist must be an array of strings" };
    }
    const slugs: string[] = [];
    for (const item of body.categoryAllowlist) {
      if (typeof item !== "string" || !item.trim()) {
        return { ok: false, error: "categoryAllowlist entries must be non-empty strings" };
      }
      const slug = item.trim().toLowerCase();
      if (!isKnownCategorySlug(slug)) {
        return { ok: false, error: `Unknown category slug: ${slug}` };
      }
      if (!slugs.includes(slug)) slugs.push(slug);
    }
    value.categoryAllowlist = slugs;
  }

  return { ok: true, value };
}

export { CONFIG_REDIS_KEY };
