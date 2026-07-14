import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { getRedis } from "./redis"

export type Subscription = {
  id: string
  topic: string
  manageTokenHash: string
  ntfyServer: string
  categoryAllowlist: string[]
  enabled: boolean
  displayName: string | null
  createdAt: number
  updatedAt: number
}

export type CreateSubscriptionInput = {
  categoryAllowlist?: string[]
  displayName?: string | null
}

export type CreateSubscriptionResult = {
  subscription: Subscription
  manageToken: string
}

export type UpdateSubscriptionPatch = {
  categoryAllowlist?: string[]
  enabled?: boolean
  displayName?: string | null
}

const SUBS_INDEX_KEY = "subs:index"
const DEFAULT_NTFY_SERVER = "https://ntfy.sh"

/** In-memory fallback when Redis is not configured (local DX). */
const memory = {
  subscriptions: new Map<string, Subscription>(),
  index: new Set<string>(),
}

function subKey(id: string): string {
  return `sub:${id}`
}

function generateId(): string {
  return randomBytes(12).toString("hex")
}

function generateTopic(): string {
  return `ozb-hot-${randomBytes(16).toString("hex")}`
}

function generateManageToken(): string {
  return randomBytes(24).toString("hex")
}

export function hashManageToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex")
}

export function verifyManageToken(
  subscription: Subscription,
  rawToken: string,
): boolean {
  const expected = subscription.manageTokenHash
  const actual = hashManageToken(rawToken)

  if (expected.length !== actual.length) return false

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  } catch {
    return false
  }
}

async function saveSubscription(subscription: Subscription): Promise<void> {
  const redis = getRedis()

  if (!redis) {
    memory.subscriptions.set(subscription.id, subscription)
    memory.index.add(subscription.id)
    return
  }

  await redis.set(subKey(subscription.id), subscription)
  await redis.sadd(SUBS_INDEX_KEY, subscription.id)
}

export async function createSubscription(
  input: CreateSubscriptionInput = {},
): Promise<CreateSubscriptionResult> {
  const now = Date.now()
  const manageToken = generateManageToken()
  const subscription: Subscription = {
    id: generateId(),
    topic: generateTopic(),
    manageTokenHash: hashManageToken(manageToken),
    ntfyServer: process.env.NTFY_SERVER ?? DEFAULT_NTFY_SERVER,
    categoryAllowlist: input.categoryAllowlist ?? [],
    enabled: true,
    displayName: input.displayName ?? null,
    createdAt: now,
    updatedAt: now,
  }

  await saveSubscription(subscription)

  return { subscription, manageToken }
}

export async function getSubscription(id: string): Promise<Subscription | null> {
  const redis = getRedis()

  if (!redis) {
    return memory.subscriptions.get(id) ?? null
  }

  return (await redis.get<Subscription>(subKey(id))) ?? null
}

export async function listAllSubscriptionIds(): Promise<string[]> {
  const redis = getRedis()

  if (!redis) {
    return [...memory.index]
  }

  const ids = await redis.smembers(SUBS_INDEX_KEY)
  return ids ?? []
}

export async function listAllSubscriptions(): Promise<Subscription[]> {
  const ids = await listAllSubscriptionIds()
  const subscriptions: Subscription[] = []

  for (const id of ids) {
    const subscription = await getSubscription(id)
    if (subscription) {
      subscriptions.push(subscription)
    }
  }

  return subscriptions.sort((a, b) => b.createdAt - a.createdAt)
}

export async function listEnabledSubscriptions(): Promise<Subscription[]> {
  const subscriptions = await listAllSubscriptions()
  return subscriptions.filter((subscription) => subscription.enabled)
}

export async function updateSubscription(
  id: string,
  patch: UpdateSubscriptionPatch,
): Promise<Subscription | null> {
  const existing = await getSubscription(id)
  if (!existing) return null

  const updated: Subscription = {
    ...existing,
    ...(patch.categoryAllowlist !== undefined
      ? { categoryAllowlist: patch.categoryAllowlist }
      : {}),
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
    updatedAt: Date.now(),
  }

  await saveSubscription(updated)
  return updated
}

export async function rotateTopic(id: string): Promise<Subscription | null> {
  const existing = await getSubscription(id)
  if (!existing) return null

  const updated: Subscription = {
    ...existing,
    topic: generateTopic(),
    updatedAt: Date.now(),
  }

  await saveSubscription(updated)
  return updated
}

export async function deleteSubscription(id: string): Promise<boolean> {
  const existing = await getSubscription(id)
  if (!existing) return false

  const redis = getRedis()

  if (!redis) {
    memory.subscriptions.delete(id)
    memory.index.delete(id)
    return true
  }

  await redis.del(subKey(id))
  await redis.srem(SUBS_INDEX_KEY, id)
  return true
}
