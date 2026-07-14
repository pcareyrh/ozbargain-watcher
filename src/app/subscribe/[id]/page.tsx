import Link from "next/link"
import { OZBARGAIN_CATEGORIES } from "@/lib/ozbargain/categories"
import { ManageSubscription } from "./ManageSubscription"
import styles from "../subscribe.module.css"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function ManageSubscriptionPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const { token } = await searchParams

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}>ozbargain-watcher</p>
        <h1>Manage alerts</h1>
        <p className={styles.lede}>
          Update categories, pause notifications, or rotate your private ntfy
          topic.
        </p>
        <nav className={styles.nav} aria-label="Related pages">
          <Link href="/subscribe">← New subscription</Link>
          <Link href="/">Status</Link>
        </nav>
      </header>

      {!token ? (
        <section className="card">
          <h2>Manage link required</h2>
          <p className="muted">
            Open this page from the manage link you received when you
            subscribed. The link includes a secret token in the URL.
          </p>
          <p>
            <Link href="/subscribe">Create a new subscription</Link>
          </p>
        </section>
      ) : (
        <ManageSubscription
          id={id}
          token={token}
          categories={OZBARGAIN_CATEGORIES}
        />
      )}
    </div>
  )
}
