import type { WatcherConfig } from "../config";
import { loadConfig } from "../store/snapshots";
import { fetchDeals } from "../ozbargain/fetchDeals";
import {
  createNotifier,
  NtfyNotifier,
  type DealAlert,
  type Notifier,
} from "../notify";
import { filterByCategory } from "./filterByCategory";
import { detectHotDeals } from "./detectHotDeals";
import {
  markAlerted,
  markAlertedForSub,
  pushRecentAlert,
  setLastRun,
  upsertDealHistory,
  wasRecentlyAlerted,
  wasRecentlyAlertedForSub,
  type DealSnapshot,
} from "../store/snapshots";
import { listEnabledSubscriptions } from "../store/subscriptions";

export type WatchCycleResult = {
  checked: number;
  tracked: number;
  hot: DealAlert[];
  alerted: DealAlert[];
  skippedCooldown: number;
  subscriptionsNotified: number;
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
 * Watch cycle (multi-subscriber fan-out):
 * 1. Fetch feed
 * 2. Update shared vote history for all deals
 * 3. Detect vote-delta hot deals (global thresholds)
 * 4. Fan-out: per enabled subscription, category filter + per-sub cooldown + notify
 * 5. Legacy fallback when no subscriptions: global category filter + global cooldown + env notifier
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

  const hot = detectHotDeals(deals, snapshotsById, config, now);
  const subscriptions = await listEnabledSubscriptions();

  const alerted: DealAlert[] = [];
  let skippedCooldown = 0;
  let subscriptionsNotified = 0;

  if (subscriptions.length === 0) {
    const eligible = filterByCategory(
      hot.map((a) => a.deal),
      config.categoryAllowlist,
    );
    const eligibleIds = new Set(eligible.map((d) => d.id));

    for (const alert of hot) {
      if (!eligibleIds.has(alert.deal.id)) continue;

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
  } else {
    const ntfyNotifier = new NtfyNotifier();

    for (const alert of hot) {
      let dealNotified = false;
      let firstSubId: string | undefined;

      for (const sub of subscriptions) {
        const categoryMatch = filterByCategory(
          [alert.deal],
          sub.categoryAllowlist,
        );
        if (categoryMatch.length === 0) continue;

        if (
          await wasRecentlyAlertedForSub(
            sub.id,
            alert.deal.id,
            config.cooldownHours,
            now,
          )
        ) {
          skippedCooldown += 1;
          continue;
        }

        try {
          await ntfyNotifier.notify(alert, {
            server: sub.ntfyServer,
            topic: sub.topic,
          });
        } catch (error) {
          console.error(
            `[ozbargain-watcher] ntfy notify failed for subscription ${sub.id}`,
            error,
          );
          continue;
        }

        await markAlertedForSub(
          sub.id,
          alert.deal.id,
          config.cooldownHours,
          now,
        );
        subscriptionsNotified += 1;

        if (!dealNotified) {
          dealNotified = true;
          firstSubId = sub.id;
        }
      }

      if (dealNotified) {
        await pushRecentAlert({
          dealId: alert.deal.id,
          title: alert.deal.title,
          url: alert.deal.url,
          categorySlug: alert.deal.categorySlug,
          deltaVotes: alert.deltaVotes,
          windowMinutes: alert.windowMinutes,
          votesPos: alert.deal.votesPos,
          alertedAt: now,
          subscriptionId: firstSubId,
        });
        alerted.push(alert);
      }
    }
  }

  await setLastRun(now);

  return {
    checked: deals.length,
    tracked: snapshotsById.size,
    hot,
    alerted,
    skippedCooldown,
    subscriptionsNotified,
    config,
    ranAt: now,
    backend,
  };
}
