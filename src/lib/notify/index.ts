import { ConsoleNotifier } from "./console"
import { NtfyNotifier } from "./ntfy"
import type { Notifier } from "./types"

export function createNotifier(kind = process.env.NOTIFIER ?? "console"): Notifier {
  switch (kind) {
    case "console":
      return new ConsoleNotifier()
    case "ntfy":
      return new NtfyNotifier()
    default:
      console.warn(`[ozbargain-watcher] Unknown NOTIFIER="${kind}", using console`)
      return new ConsoleNotifier()
  }
}

export { ConsoleNotifier } from "./console"
export { NtfyNotifier, sendNtfyMessage, sendNtfyTestMessage } from "./ntfy"
export type { DealAlert, Notifier, NtfyTarget } from "./types"
