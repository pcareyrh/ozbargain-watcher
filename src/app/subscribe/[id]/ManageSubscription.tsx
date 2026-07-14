"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { OzBargainCategory } from "@/lib/ozbargain/categories"
import { CopyButton } from "../CopyButton"
import styles from "../subscribe.module.css"

type PublicSubscription = {
  id: string
  topic: string
  ntfySubscribeUrl: string
  categoryAllowlist: string[]
  enabled: boolean
  displayName: string | null
  error?: string
}

type Props = {
  id: string
  token: string
  categories: readonly OzBargainCategory[]
}

export function ManageSubscription({ id, token, categories }: Props) {
  const router = useRouter()
  const [subscription, setSubscription] = useState<PublicSubscription | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState("")
  const [monitorAll, setMonitorAll] = useState(true)
  const [allowlist, setAllowlist] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  const [toggling, setToggling] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const authHeaders = { Authorization: `Bearer ${token}` }

  const applySubscription = useCallback((sub: PublicSubscription) => {
    setSubscription(sub)
    setDisplayName(sub.displayName ?? "")
    const all = sub.categoryAllowlist.length === 0
    setMonitorAll(all)
    setAllowlist(
      all ? categories.map((c) => c.slug) : sub.categoryAllowlist,
    )
  }, [categories])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const res = await fetch(
          `/api/subscriptions/${id}?token=${encodeURIComponent(token)}`,
        )
        const data = (await res.json()) as PublicSubscription
        if (!res.ok) {
          if (!cancelled) {
            setLoadError(data.error ?? "Failed to load subscription")
          }
          return
        }
        if (!cancelled) {
          applySubscription(data)
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load subscription",
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, token, applySubscription])

  function toggleCategory(slug: string) {
    setAllowlist((current) =>
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug],
    )
  }

  async function handleSaveCategories(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMessage(null)
    setSaveError(null)

    const categoryAllowlist = monitorAll ? [] : allowlist
    if (!monitorAll && categoryAllowlist.length === 0) {
      setSaveError("Select at least one category, or enable All categories.")
      setSaving(false)
      return
    }

    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          categoryAllowlist,
          monitorAll,
          displayName: displayName.trim() || null,
        }),
      })
      const data = (await res.json()) as PublicSubscription
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save")
        return
      }
      applySubscription(data)
      setSaveMessage("Saved.")
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    setTestMessage(null)
    setTestError(null)

    try {
      const res = await fetch(`/api/subscriptions/${id}/test`, {
        method: "POST",
        headers: authHeaders,
      })
      const data = await res.json()
      if (!res.ok) {
        setTestError(data.error ?? "Failed to send test notification")
        return
      }
      setTestMessage("Test notification sent. Check your ntfy app.")
    } catch (err) {
      setTestError(
        err instanceof Error ? err.message : "Failed to send test notification",
      )
    } finally {
      setTesting(false)
    }
  }

  async function handleToggleEnabled() {
    if (!subscription) return

    const nextEnabled = !subscription.enabled
    const label = nextEnabled ? "resume" : "pause"
    if (!window.confirm(`Are you sure you want to ${label} alerts?`)) return

    setToggling(true)
    setActionError(null)

    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ enabled: nextEnabled }),
      })
      const data = (await res.json()) as PublicSubscription
      if (!res.ok) {
        setActionError(data.error ?? `Failed to ${label} alerts`)
        return
      }
      applySubscription(data)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `Failed to ${label} alerts`,
      )
    } finally {
      setToggling(false)
    }
  }

  async function handleRotateTopic() {
    if (
      !window.confirm(
        "Rotate your topic? Your old topic will stop working and you must re-subscribe in ntfy.",
      )
    ) {
      return
    }

    setRotating(true)
    setActionError(null)

    try {
      const res = await fetch(`/api/subscriptions/${id}/rotate-topic`, {
        method: "POST",
        headers: authHeaders,
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error ?? "Failed to rotate topic")
        return
      }
      setSubscription((current) =>
        current
          ? {
              ...current,
              topic: data.topic,
              ntfySubscribeUrl: data.ntfySubscribeUrl,
            }
          : current,
      )
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to rotate topic",
      )
    } finally {
      setRotating(false)
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Delete this subscription permanently? You will stop receiving alerts.",
      )
    ) {
      return
    }

    setDeleting(true)
    setActionError(null)

    try {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error ?? "Failed to delete subscription")
        setDeleting(false)
        return
      }
      router.push("/subscribe")
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete subscription",
      )
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <section className="card">
        <p className="muted">Loading subscription…</p>
      </section>
    )
  }

  if (loadError || !subscription) {
    return (
      <section className="card">
        <h2>Unable to load</h2>
        <p className="err">{loadError ?? "Subscription not found"}</p>
        <p className="muted">
          Check that you opened the full manage link from your subscription
          email or bookmark.
        </p>
        <p>
          <Link href="/subscribe">Create a new subscription</Link>
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Your alerts</h2>
          <span
            className={`${styles.statusBadge} ${subscription.enabled ? styles.active : styles.paused}`}
          >
            {subscription.enabled ? "Active" : "Paused"}
          </span>
        </div>

        {subscription.displayName && (
          <p className="muted">Signed up as {subscription.displayName}</p>
        )}

        <div>
          <p className={styles.sectionTitle}>Topic</p>
          <div className={styles.copyRow}>
            <code className={styles.copyValue}>{subscription.topic}</code>
            <CopyButton value={subscription.topic} label="topic" />
          </div>
        </div>

        <div>
          <p className={styles.sectionTitle}>Subscribe URL</p>
          <div className={styles.copyRow}>
            <a
              href={subscription.ntfySubscribeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.copyValue}
            >
              {subscription.ntfySubscribeUrl}
            </a>
            <CopyButton
              value={subscription.ntfySubscribeUrl}
              label="subscribe URL"
            />
          </div>
        </div>

        <p className={styles.warning} role="note">
          Keep your topic secret. Anyone with the topic can read your
          notifications.
        </p>

        <div className="row">
          <button type="button" disabled={testing} onClick={handleTest}>
            {testing ? "Sending…" : "Send test notification"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={toggling}
            onClick={handleToggleEnabled}
          >
            {toggling
              ? "Updating…"
              : subscription.enabled
                ? "Pause alerts"
                : "Resume alerts"}
          </button>
        </div>

        {testMessage && <p className="ok">{testMessage}</p>}
        {testError && <p className="err">{testError}</p>}
        {actionError && <p className="err">{actionError}</p>}
      </section>

      <form className="card" onSubmit={handleSaveCategories}>
        <h2>Categories</h2>
        <p className="muted">
          Empty allowlist means all categories. Changes apply on the next watch
          run.
        </p>

        <label htmlFor="manageDisplayName">
          Display name
          <input
            id="manageDisplayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Optional"
            autoComplete="name"
          />
        </label>

        <fieldset>
          <legend>Category allowlist</legend>
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
          <button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save categories"}
          </button>
        </div>

        {saveMessage && <p className="ok">{saveMessage}</p>}
        {saveError && <p className="err">{saveError}</p>}
      </form>

      <section className={`card ${styles.dangerZone}`}>
        <h2>Danger zone</h2>
        <p className="muted">
          Rotate your topic if it was exposed, or delete when you no longer want
          alerts.
        </p>
        <div className="row">
          <button
            type="button"
            className="secondary"
            disabled={rotating}
            onClick={handleRotateTopic}
          >
            {rotating ? "Rotating…" : "Rotate topic"}
          </button>
          <button type="button" disabled={deleting} onClick={handleDelete}>
            {deleting ? "Deleting…" : "Delete subscription"}
          </button>
        </div>
      </section>
    </>
  )
}
