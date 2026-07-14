import { NextResponse } from "next/server"
import { rotateTopic } from "@/lib/store/subscriptions"
import { requireSubscription } from "@/lib/subscriptions/auth"
import { buildNtfySubscribeUrl } from "@/lib/subscriptions/response"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const auth = await requireSubscription(id, request)
  if (!auth.ok) return auth.response

  const updated = await rotateTopic(id)
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    topic: updated.topic,
    ntfySubscribeUrl: buildNtfySubscribeUrl(updated.ntfyServer, updated.topic),
  })
}
