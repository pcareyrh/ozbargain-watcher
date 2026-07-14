import type { DealAlert, Notifier, NtfyTarget } from "./types"

const DEFAULT_NTFY_SERVER = "https://ntfy.sh"
const MAX_TITLE_LENGTH = 200

function resolveTarget(target?: NtfyTarget): NtfyTarget | null {
  if (target) return target

  const topic = process.env.NTFY_TOPIC
  if (!topic) {
    console.warn(
      "[ozbargain-watcher] NTFY_TOPIC not set and no target provided, skipping ntfy notification",
    )
    return null
  }

  return {
    server: process.env.NTFY_SERVER ?? DEFAULT_NTFY_SERVER,
    topic,
    token: process.env.NTFY_TOKEN,
  }
}

function buildMessageBody(alert: DealAlert): string {
  const { deal, deltaVotes, windowMinutes } = alert
  const category = deal.categoryLabel ?? deal.categorySlug ?? "unknown"

  return [
    deal.title,
    `+${deltaVotes} votes in ${windowMinutes}m`,
    `${deal.votesPos}↑ ${deal.votesNeg}↓`,
    category,
    deal.url,
  ].join("\n")
}

function truncateTitle(title: string): string {
  if (title.length <= MAX_TITLE_LENGTH) return title
  return `${title.slice(0, MAX_TITLE_LENGTH - 1)}…`
}

export async function sendNtfyMessage(
  target: NtfyTarget,
  body: string,
  headers: Record<string, string>,
): Promise<void> {
  const server = target.server.replace(/\/$/, "")
  const url = `${server}/${encodeURIComponent(target.topic)}`
  const token = target.token ?? process.env.NTFY_TOKEN

  const requestHeaders: Record<string, string> = { ...headers }
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: "POST",
    headers: requestHeaders,
    body,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `ntfy request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`,
    )
  }
}

export async function sendNtfyTestMessage(
  target: NtfyTarget,
  message = "ozbargain-watcher test notification",
): Promise<void> {
  await sendNtfyMessage(target, message, {
    Title: "ozbargain-watcher test",
    Tags: "test",
    Priority: "default",
  })
}

export class NtfyNotifier implements Notifier {
  async notify(alert: DealAlert, target?: NtfyTarget): Promise<void> {
    const resolved = resolveTarget(target)
    if (!resolved) return

    const { deal } = alert
    const category = deal.categoryLabel ?? deal.categorySlug ?? "unknown"

    try {
      await sendNtfyMessage(resolved, buildMessageBody(alert), {
        Title: truncateTitle(deal.title),
        Click: deal.url,
        Tags: "hot,money",
        Priority: "high",
        ...(category !== "unknown" ? { "X-Category": category } : {}),
      })
    } catch (error) {
      console.error("[ozbargain-watcher] ntfy notification failed:", error)
      throw error
    }
  }
}
