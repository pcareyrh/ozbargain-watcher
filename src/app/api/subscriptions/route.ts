import { NextResponse } from "next/server"
import { createSubscription } from "@/lib/store/subscriptions"
import { isCreateRateLimited } from "@/lib/subscriptions/rate-limit"
import {
  buildManageUrl,
  toPublicSubscription,
} from "@/lib/subscriptions/response"
import { parseCategoryAllowlist } from "@/lib/subscriptions/validation"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (isCreateRateLimited(request)) {
    return NextResponse.json(
      { error: "Too many subscription requests. Try again later." },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const parsed = parseCategoryAllowlist({
    categoryAllowlist: input.categoryAllowlist,
    monitorAll: input.monitorAll,
  })

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  let displayName: string | null | undefined
  if (input.displayName !== undefined) {
    if (input.displayName === null) {
      displayName = null
    } else if (typeof input.displayName === "string") {
      const trimmed = input.displayName.trim()
      displayName = trimmed.length > 0 ? trimmed : null
    } else {
      return NextResponse.json(
        { error: "displayName must be a string or null" },
        { status: 400 },
      )
    }
  }

  const { subscription, manageToken } = await createSubscription({
    categoryAllowlist: parsed.categoryAllowlist,
    ...(displayName !== undefined ? { displayName } : {}),
  })

  return NextResponse.json(
    {
      ...toPublicSubscription(subscription),
      manageToken,
      manageUrl: buildManageUrl(subscription.id, manageToken),
    },
    { status: 201 },
  )
}
