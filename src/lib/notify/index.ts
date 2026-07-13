import { ConsoleNotifier } from "./console";
import type { Notifier } from "./types";

export function createNotifier(kind = process.env.NOTIFIER ?? "console"): Notifier {
  switch (kind) {
    case "console":
      return new ConsoleNotifier();
    default:
      console.warn(`[ozbargain-watcher] Unknown NOTIFIER="${kind}", using console`);
      return new ConsoleNotifier();
  }
}

export type { DealAlert, Notifier } from "./types";
