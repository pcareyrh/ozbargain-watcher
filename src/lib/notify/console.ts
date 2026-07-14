import type { DealAlert, Notifier, NtfyTarget } from "./types"

export class ConsoleNotifier implements Notifier {
  async notify(alert: DealAlert, _target?: NtfyTarget): Promise<void> {
    const { deal, deltaVotes, windowMinutes } = alert
    const category = deal.categoryLabel ?? deal.categorySlug ?? "unknown"

    console.log(
      [
        "[ozbargain-watcher] HOT DEAL",
        `+${deltaVotes} votes / ${windowMinutes}m`,
        `| ${deal.votesPos}↑ ${deal.votesNeg}↓`,
        `| ${category}`,
        `| ${deal.title}`,
        `| ${deal.url}`,
      ].join(" "),
    )
  }
}
