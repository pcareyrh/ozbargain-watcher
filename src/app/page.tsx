import Link from "next/link"
import { OZBARGAIN_CATEGORIES } from "@/lib/ozbargain/categories"
import { fetchDeals } from "@/lib/ozbargain/fetchDeals"
import type { Deal } from "@/lib/ozbargain/types"
import { getLastRun, getRecentAlerts, loadConfig } from "@/lib/store/snapshots"
import { ConfigForm } from "./ConfigForm"
import styles from "./page.module.css"

export const dynamic = "force-dynamic"

function formatTime(ms: number | null): string {
  if (!ms) return "Never"
  return new Date(ms).toLocaleString()
}

function formatPublishedAt(publishedAt: string | null): string {
  if (!publishedAt) return "Unknown time"
  const ms = Date.parse(publishedAt)
  if (!Number.isFinite(ms)) return publishedAt
  return new Date(ms).toLocaleString()
}

function sortNewestFirst(deals: Deal[]): Deal[] {
  return [...deals].sort((a, b) => {
    const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0
    return bTime - aTime
  })
}

export default async function Home() {
  const [config, lastRun, recent, feedResult] = await Promise.all([
    loadConfig(),
    getLastRun(),
    getRecentAlerts(20),
    fetchDeals()
      .then((deals) => ({ ok: true as const, deals }))
      .catch(() => ({ ok: false as const, deals: [] as Deal[] })),
  ])

  const newestDeals = sortNewestFirst(feedResult.deals).slice(0, 3)
  const latestHotDeal = recent[0] ?? null
  const feedFailed = !feedResult.ok

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}>ozbargain-watcher</p>
        <h1>Hot deal monitor</h1>
        <p className={styles.lede}>
          Alerts when a deal gains more than {config.voteDelta} upvotes in{" "}
          {config.windowMinutes} minutes
          {config.categoryAllowlist.length === 0
            ? " across all categories"
            : ` in ${config.categoryAllowlist.length} categories`}
          .
        </p>
        <p className={styles.lede}>
          <Link href="/subscribe">Get alerts</Link>
        </p>
      </header>

      <section className={styles.meta}>
        <div>
          <span className={styles.label}>Last run</span>
          <strong>{formatTime(lastRun)}</strong>
        </div>
        <div>
          <span className={styles.label}>Threshold</span>
          <strong>
            &gt;{config.voteDelta} / {config.windowMinutes}m
          </strong>
        </div>
        <div>
          <span className={styles.label}>Cooldown</span>
          <strong>{config.cooldownHours}h</strong>
        </div>
        <div>
          <span className={styles.label}>Categories</span>
          <strong>
            {config.categoryAllowlist.length === 0
              ? "All"
              : config.categoryAllowlist.join(", ")}
          </strong>
        </div>
      </section>

      <section className={`card ${styles.hotFeature}`} aria-labelledby="latest-hot-deal-heading">
        <h2 id="latest-hot-deal-heading">Latest Hot Deal</h2>
        {latestHotDeal ? (
          <div className={styles.hotBody}>
            <a
              href={latestHotDeal.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.hotTitle}
            >
              {latestHotDeal.title}
            </a>
            <p className={styles.hotMeta}>
              +{latestHotDeal.deltaVotes} votes in {latestHotDeal.windowMinutes}
              m · {latestHotDeal.votesPos}↑
              {latestHotDeal.categorySlug
                ? ` · ${latestHotDeal.categorySlug}`
                : ""}
            </p>
            <p className="muted">Alerted {formatTime(latestHotDeal.alertedAt)}</p>
          </div>
        ) : (
          <p className="muted">No hot deals alerted yet.</p>
        )}
      </section>

      <section className="card" aria-labelledby="newest-deals-heading">
        <h2 id="newest-deals-heading">Newest on OzBargain</h2>
        {feedFailed ? (
          <p className="muted">Couldn&apos;t load newest deals.</p>
        ) : newestDeals.length === 0 ? (
          <p className="muted">No deals in the feed right now.</p>
        ) : (
          <ul className={styles.dealList}>
            {newestDeals.map((deal) => (
              <li key={deal.id}>
                <a href={deal.url} target="_blank" rel="noopener noreferrer">
                  {deal.title}
                </a>
                <span className="muted">
                  {deal.votesPos}↑ {deal.votesNeg}↓
                  {deal.categoryLabel ? ` · ${deal.categoryLabel}` : ""}
                  {" · "}
                  {formatPublishedAt(deal.publishedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfigForm initialConfig={config} categories={OZBARGAIN_CATEGORIES} />

      <section className="card">
        <h2>Recent alerts</h2>
        {recent.length === 0 ? (
          <p className="muted">No alerts yet. Run a watch cycle to populate.</p>
        ) : (
          <ul className={styles.alerts}>
            {recent.map((alert) => (
              <li key={`${alert.dealId}-${alert.alertedAt}`}>
                <a href={alert.url} target="_blank" rel="noopener noreferrer">
                  {alert.title}
                </a>
                <span className="muted">
                  +{alert.deltaVotes} / {alert.windowMinutes}m ·{" "}
                  {alert.votesPos}↑ · {formatTime(alert.alertedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
