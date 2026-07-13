import type { AlertConfig } from "../config";
import type { Deal } from "../ozbargain/types";
import type { DealSnapshot } from "../store/snapshots";
import type { DealAlert } from "../notify/types";

/**
 * Detect deals whose upvote gain in the rolling window exceeds voteDelta.
 * Pure function — no I/O, no env reads.
 */
export function detectHotDeals(
  deals: Deal[],
  snapshotsById: Map<string, DealSnapshot>,
  config: AlertConfig,
  now = Date.now(),
): DealAlert[] {
  const windowMs = config.windowMinutes * 60 * 1000;
  const windowStart = now - windowMs;
  const hot: DealAlert[] = [];

  for (const deal of deals) {
    const snapshot = snapshotsById.get(deal.id);
    if (!snapshot || snapshot.history.length < 2) continue;

    const inWindow = snapshot.history.filter((s) => s.at >= windowStart);
    if (inWindow.length < 2) {
      // Not enough samples inside the window yet — use oldest available
      // only if the oldest sample is still within the window buffer we keep.
      // Require at least one prior sample within the window.
      continue;
    }

    const oldestInWindow = inWindow[0];
    const deltaVotes = deal.votesPos - oldestInWindow.votesPos;

    if (deltaVotes > config.voteDelta) {
      hot.push({
        deal,
        deltaVotes,
        windowMinutes: config.windowMinutes,
      });
    }
  }

  return hot;
}
