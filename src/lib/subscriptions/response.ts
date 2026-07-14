import type { Subscription } from "@/lib/store/subscriptions"

export function buildNtfySubscribeUrl(server: string, topic: string): string {
  const base = server.replace(/\/$/, "")
  return `${base}/${topic}`
}

export function toPublicSubscription(subscription: Subscription) {
  return {
    id: subscription.id,
    topic: subscription.topic,
    ntfyServer: subscription.ntfyServer,
    ntfySubscribeUrl: buildNtfySubscribeUrl(
      subscription.ntfyServer,
      subscription.topic,
    ),
    categoryAllowlist: subscription.categoryAllowlist,
    enabled: subscription.enabled,
    displayName: subscription.displayName,
  }
}

export function buildManageUrl(id: string, manageToken: string): string {
  return `/subscribe/${id}?token=${manageToken}`
}
