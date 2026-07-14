import { NextResponse } from "next/server"
import { sendNtfyTestMessage } from "@/lib/notify"
import { requireSubscription } from "@/lib/subscriptions/auth"
import { isTestRateLimited } from "@/lib/subscriptions/rate-limit"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const auth = await requireSubscription(id, request)
  if (!auth.ok) return auth.response

  if (isTestRateLimited(id)) {
    return NextResponse.json(
      { error: "Too many test notifications. Try again later." },
      { status: 429 },
    )
  }

  try {
    await sendNtfyTestMessage({
      server: auth.subscription.ntfyServer,
      topic: auth.subscription.topic,
    })
  } catch (error) {
    console.error("[ozbargain-watcher] test notification failed", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send test notification",
      },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true })
}
