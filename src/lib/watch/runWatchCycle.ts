import type { WatcherConfig } from "../config";
import { loadConfig } from "../store/snapshots";
import { fetchDeals } from "../ozbargain/fetchDeals";
import { createNotifier, type DealAlert, type Notifier } from "../notify";
import { filterByCategory } from "./filterByCategory";
import { detectHotDeals } from "./detectHotDeals";
import {
  markAlerted,
  pushRecentAlert,
  setLastRun,
  upsertDealHistory,
  wasRecentlyAlerted,
  type DealSnapshot,
} from "../store/snapshots";

export type WatchCycleResult = {
  checked: number;
  tracked: number;
  hot: DealAlert[];
  alerted: DealAlert[];
  skippedCooldown: number;
  config: WatcherConfig;
  ranAt: number;
  backend: "redis" | "memory";
};

export type RunWatchCycleOptions = {
  config?: WatcherConfig;
  notifier?: Notifier;
  now?: number;
};

/**
 * Watch cycle shape (multi-user-ready):
 * 1. Fetch feed
 * 2. Update shared vote history for all deals
 * 3. Detect vote-delta hot deals
 * 4. Apply category allowlist
 * 5. Apply cooldown + notify
 */
export async function runWatchCycle(
  options: RunWatchCycleOptions = {},
): Promise<WatchCycleResult> {
  const now = options.now ?? Date.now();
  const config = options.config ?? (await loadConfig());
  const notifier = options.notifier ?? createNotifier();
  const backend =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? "redis"
      : "memory";

  const deals = await fetchDeals();

  const snapshotsById = new Map<string, DealSnapshot>();
  for (const deal of deals) {
    const snapshot = await upsertDealHistory(deal, config.windowMinutes, now);
    snapshotsById.set(deal.id, snapshot);
  }

  const detected = detectHotDeals(deals, snapshotsById, config, now);
  const eligible = filterByCategory(
    detected.map((a) => a.deal),
    config.categoryAllowlist,
  );
  const eligibleIds = new Set(eligible.map((d) => d.id));
  const hot = detected.filter((a) => eligibleIds.has(a.deal.id));

  const alerted: DealAlert[] = [];
  let skippedCooldown = 0;

  for (const alert of hot) {
    if (await wasRecentlyAlerted(alert.deal.id, config.cooldownHours, now)) {
      skippedCooldown += 1;
      continue;
    }

    await notifier.notify(alert);
    await markAlerted(alert.deal.id, config.cooldownHours, now);
    await pushRecentAlert({
      dealId: alert.deal.id,
      title: alert.deal.title,
      url: alert.deal.url,
      categorySlug: alert.deal.categorySlug,
      deltaVotes: alert.deltaVotes,
      windowMinutes: alert.windowMinutes,
      votesPos: alert.deal.votesPos,
      alertedAt: now,
    });
    alerted.push(alert);
  }

  await setLastRun(now);

  return {
    checked: deals.length,
    tracked: snapshotsById.size,
    hot,
    alerted,
    skippedCooldown,
    config,
    ranAt: now,
    backend,
  };
}
