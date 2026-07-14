import Link from "next/link"
import { OZBARGAIN_CATEGORIES } from "@/lib/ozbargain/categories";
import { getLastRun, getRecentAlerts, loadConfig } from "@/lib/store/snapshots";
import { ConfigForm } from "./ConfigForm";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

function formatTime(ms: number | null): string {
  if (!ms) return "Never";
  return new Date(ms).toLocaleString();
}

export default async function Home() {
  const [config, lastRun, recent] = await Promise.all([
    loadConfig(),
    getLastRun(),
    getRecentAlerts(20),
  ]);

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
  );
}
