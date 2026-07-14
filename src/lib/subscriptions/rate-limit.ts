const createRateLimit = new Map<string, number[]>()
const testRateLimit = new Map<string, number[]>()

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) {
    return xff.split(",")[0].trim()
  }
  return "unknown"
}

function pruneAndCheck(
  map: Map<string, number[]>,
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now()
  const timestamps = map.get(key) ?? []
  const recent = timestamps.filter((t) => now - t < windowMs)

  if (recent.length >= max) {
    map.set(key, recent)
    return true
  }

  recent.push(now)
  map.set(key, recent)
  return false
}

export function isCreateRateLimited(request: Request): boolean {
  const ip = getClientIp(request)
  return pruneAndCheck(createRateLimit, ip, 10, 60_000)
}

export function isTestRateLimited(subscriptionId: string): boolean {
  return pruneAndCheck(testRateLimit, subscriptionId, 5, 60_000)
}
