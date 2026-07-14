import { NextResponse } from "next/server"
import {
  getSubscription,
  verifyManageToken,
  type Subscription,
} from "@/lib/store/subscriptions"

export function getManageToken(request: Request): string | null {
  const auth = request.headers.get("authorization")
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7)
  }

  const headerToken = request.headers.get("x-manage-token")
  if (headerToken) return headerToken

  const url = new URL(request.url)
  const queryToken = url.searchParams.get("token")
  if (queryToken) return queryToken

  return null
}

type RequireSubscriptionResult =
  | { ok: true; subscription: Subscription }
  | { ok: false; response: NextResponse }

export async function requireSubscription(
  id: string,
  request: Request,
): Promise<RequireSubscriptionResult> {
  const token = getManageToken(request)
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const subscription = await getSubscription(id)
  if (!subscription) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    }
  }

  if (!verifyManageToken(subscription, token)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { ok: true, subscription }
}
