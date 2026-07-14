"use client"

import { useState } from "react"
import Link from "next/link"
import { CopyButton } from "./CopyButton"
import styles from "./subscribe.module.css"

type Props = {
  id: string
  topic: string
  ntfySubscribeUrl: string
  manageToken: string
  manageUrl: string
}

export function ConnectScreen({
  id,
  topic,
  ntfySubscribeUrl,
  manageToken,
  manageUrl,
}: Props) {
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  const fullManageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${manageUrl}`
      : manageUrl

  async function handleTest() {
    setTesting(true)
    setTestMessage(null)
    setTestError(null)

    try {
      const res = await fetch(`/api/subscriptions/${id}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${manageToken}` },
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

  return (
    <section className="card">
      <h2>You&apos;re subscribed</h2>
      <p className="muted">
        Connect ntfy to your private topic to receive push alerts when hot deals
        match your categories.
      </p>

      <div>
        <p className={styles.sectionTitle}>Topic</p>
        <div className={styles.copyRow}>
          <code className={styles.copyValue}>{topic}</code>
          <CopyButton value={topic} label="topic" />
        </div>
      </div>

      <div>
        <p className={styles.sectionTitle}>Subscribe URL</p>
        <div className={styles.copyRow}>
          <a
            href={ntfySubscribeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.copyValue}
          >
            {ntfySubscribeUrl}
          </a>
          <CopyButton value={ntfySubscribeUrl} label="subscribe URL" />
        </div>
      </div>

      <div>
        <p className={styles.sectionTitle}>How to connect</p>
        <ol className={styles.instructions}>
          <li>Install the ntfy app on your phone or desktop.</li>
          <li>
            Subscribe to the topic above, or open the subscribe URL in your
            browser.
          </li>
          <li>Use the test button below to confirm notifications arrive.</li>
        </ol>
      </div>

      <div>
        <p className={styles.sectionTitle}>Manage link</p>
        <p className="muted small">
          Bookmark this link to change categories, pause alerts, or rotate your
          topic later.
        </p>
        <div className={styles.copyRow}>
          <code className={styles.copyValue}>{fullManageUrl}</code>
          <CopyButton value={fullManageUrl} label="manage link" />
        </div>
        <p className="muted small" style={{ marginTop: "0.5rem" }}>
          <Link href={manageUrl}>Open manage page</Link>
        </p>
      </div>

      <p className={styles.warning} role="note">
        Keep your topic secret. Anyone with the topic can read your
        notifications.
      </p>

      <div className="row">
        <button type="button" disabled={testing} onClick={handleTest}>
          {testing ? "Sending…" : "Send test notification"}
        </button>
        <Link
          href={manageUrl}
          className={styles.manageLink}
          aria-label="Manage subscription"
        >
          Manage subscription
        </Link>
      </div>

      {testMessage && <p className="ok">{testMessage}</p>}
      {testError && <p className="err">{testError}</p>}
    </section>
  )
}
