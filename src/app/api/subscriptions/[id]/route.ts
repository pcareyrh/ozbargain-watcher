import { NextResponse } from "next/server"
import {
  deleteSubscription,
  updateSubscription,
} from "@/lib/store/subscriptions"
import { requireSubscription } from "@/lib/subscriptions/auth"
import { toPublicSubscription } from "@/lib/subscriptions/response"
import { parseCategoryAllowlist } from "@/lib/subscriptions/validation"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const auth = await requireSubscription(id, request)
  if (!auth.ok) return auth.response

  return NextResponse.json(toPublicSubscription(auth.subscription))
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params
  const auth = await requireSubscription(id, request)
  if (!auth.ok) return auth.response

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
  const patch: {
    categoryAllowlist?: string[]
    enabled?: boolean
    displayName?: string | null
  } = {}

  if (input.categoryAllowlist !== undefined || input.monitorAll !== undefined) {
    const parsed = parseCategoryAllowlist({
      categoryAllowlist: input.categoryAllowlist,
      monitorAll: input.monitorAll,
    })
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    patch.categoryAllowlist = parsed.categoryAllowlist
  }

  if (input.enabled !== undefined) {
    if (typeof input.enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled must be a boolean" },
        { status: 400 },
      )
    }
    patch.enabled = input.enabled
  }

  if (input.displayName !== undefined) {
    if (input.displayName === null) {
      patch.displayName = null
    } else if (typeof input.displayName === "string") {
      const trimmed = input.displayName.trim()
      patch.displayName = trimmed.length > 0 ? trimmed : null
    } else {
      return NextResponse.json(
        { error: "displayName must be a string or null" },
        { status: 400 },
      )
    }
  }

  if (
    patch.categoryAllowlist === undefined &&
    patch.enabled === undefined &&
    patch.displayName === undefined
  ) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    )
  }

  const updated = await updateSubscription(id, patch)
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(toPublicSubscription(updated))
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params
  const auth = await requireSubscription(id, request)
  if (!auth.ok) return auth.response

  const deleted = await deleteSubscription(id)
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
