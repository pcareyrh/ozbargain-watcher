import type { DealAlert, Notifier } from "./types";

export class ConsoleNotifier implements Notifier {
  async notify(alert: DealAlert): Promise<void> {
    const { deal, deltaVotes, windowMinutes } = alert;
    const category = deal.categoryLabel ?? deal.categorySlug ?? "unknown";

    console.log(
      [
        "[ozbargain-watcher] HOT DEAL",
        `+${deltaVotes} votes / ${windowMinutes}m`,
        `| ${deal.votesPos}↑ ${deal.votesNeg}↓`,
        `| ${category}`,
        `| ${deal.title}`,
        `| ${deal.url}`,
      ].join(" "),
    );
  }
}
