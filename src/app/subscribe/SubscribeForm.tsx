"use client"

import { useState } from "react"
import { OZBARGAIN_CATEGORIES } from "@/lib/ozbargain/categories"
import type { OzBargainCategory } from "@/lib/ozbargain/categories"
import { ConnectScreen } from "./ConnectScreen"

type CreateResponse = {
  id: string
  topic: string
  ntfySubscribeUrl: string
  manageToken: string
  manageUrl: string
  error?: string
}

type Props = {
  categories: readonly OzBargainCategory[]
}

export function SubscribeForm({ categories }: Props) {
  const [displayName, setDisplayName] = useState("")
  const [monitorAll, setMonitorAll] = useState(true)
  const [allowlist, setAllowlist] = useState<string[]>(
    categories.map((c) => c.slug),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreateResponse | null>(null)

  function toggleCategory(slug: string) {
    setAllowlist((current) =>
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug],
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const categoryAllowlist = monitorAll ? [] : allowlist
    if (!monitorAll && categoryAllowlist.length === 0) {
      setError("Select at least one category, or enable All categories.")
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          categoryAllowlist,
          monitorAll,
        }),
      })

      const data = (await res.json()) as CreateResponse
      if (!res.ok) {
        setError(data.error ?? "Failed to create subscription")
        return
      }

      setCreated(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subscription")
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <ConnectScreen
        id={created.id}
        topic={created.topic}
        ntfySubscribeUrl={created.ntfySubscribeUrl}
        manageToken={created.manageToken}
        manageUrl={created.manageUrl}
      />
    )
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Get push alerts</h2>
      <p className="muted">
        Choose categories to watch. You&apos;ll get ntfy notifications when a
        deal gains votes quickly in your selected categories.
      </p>

      <label htmlFor="displayName">
        Display name
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Optional — e.g. Patrick's alerts"
          autoComplete="name"
        />
      </label>

      <fieldset>
        <legend>Categories</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={monitorAll}
            onChange={(e) => setMonitorAll(e.target.checked)}
          />
          All categories
        </label>
        <div className={`checks ${monitorAll ? "dimmed" : ""}`}>
          {categories.map((cat) => (
            <label key={cat.slug} className="check">
              <input
                type="checkbox"
                checked={allowlist.includes(cat.slug)}
                disabled={monitorAll}
                onChange={() => toggleCategory(cat.slug)}
              />
              {cat.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="row">
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Subscribe"}
        </button>
      </div>

      {error && <p className="err">{error}</p>}
    </form>
  )
}
