"use client"

import { useState } from "react"
import { CopyButton } from "./CopyButton"
import styles from "./subscribe.module.css"

type ListedSubscription = {
  id: string
  topic: string
  ntfyServer: string
  ntfySubscribeUrl: string
  categoryAllowlist: string[]
  enabled: boolean
  displayName: string | null
  createdAt: number
  updatedAt: number
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString()
}

function formatCategories(allowlist: string[]): string {
  if (allowlist.length === 0) return "All categories"
  if (allowlist.length <= 3) return allowlist.join(", ")
  return `${allowlist.slice(0, 3).join(", ")} +${allowlist.length - 3}`
}

export function TopicIndex() {
  const [secret, setSecret] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [subscriptions, setSubscriptions] = useState<ListedSubscription[]>([])

  const handleLoad = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/subscriptions", {
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      })
      const data = await res.json()
      if (!res.ok) {
        setLoaded(false)
        setSubscriptions([])
        setError(data.error ?? "Failed to load subscriptions")
        return
      }

      setSubscriptions(data.subscriptions ?? [])
      setLoaded(true)
    } catch (err) {
      setLoaded(false)
      setSubscriptions([])
      setError(
        err instanceof Error ? err.message : "Failed to load subscriptions",
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void handleLoad()
  }

  return (
    <section className="card" aria-labelledby="topic-index-heading">
      <h2 id="topic-index-heading">Existing ntfy topics</h2>
      <p className="muted">
        Admin-only index of subscription topics. Protected by{" "}
        <code>CRON_SECRET</code> / <code>ADMIN_SECRET</code>.
      </p>
      <p className={styles.warning} role="note">
        Topics are secrets. Only unlock this list on a trusted device.
      </p>

      <form className={styles.topicUnlock} onSubmit={handleSubmit}>
        <label>
          Admin secret
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Bearer secret"
            autoComplete="off"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Loading…" : "Load topics"}
        </button>
      </form>

      {error ? <p className="err">{error}</p> : null}

      {!loaded && !error ? (
        <p className="muted">Enter admin secret to list topics.</p>
      ) : null}

      {loaded && subscriptions.length === 0 ? (
        <p className="muted">No subscriptions yet.</p>
      ) : null}

      {loaded && subscriptions.length > 0 ? (
        <ul className={styles.topicList}>
          {subscriptions.map((subscription) => (
            <li key={subscription.id} className={styles.topicItem}>
              <div className={styles.topicHeader}>
                <strong>
                  {subscription.displayName ?? `Subscription ${subscription.id.slice(0, 8)}`}
                </strong>
                <span
                  className={`${styles.statusBadge} ${
                    subscription.enabled ? styles.active : styles.paused
                  }`}
                >
                  {subscription.enabled ? "Active" : "Paused"}
                </span>
              </div>

              <p className="muted small">
                {formatCategories(subscription.categoryAllowlist)} · Created{" "}
                {formatTime(subscription.createdAt)}
              </p>

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
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
