import Link from "next/link"
import { OZBARGAIN_CATEGORIES } from "@/lib/ozbargain/categories"
import { SubscribeForm } from "./SubscribeForm"
import styles from "./subscribe.module.css"

export const dynamic = "force-dynamic"

export default function SubscribePage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}>ozbargain-watcher</p>
        <h1>Hot deal push alerts</h1>
        <p className={styles.lede}>
          Get ntfy notifications when OzBargain deals start trending in the
          categories you care about.
        </p>
        <nav className={styles.nav} aria-label="Related pages">
          <Link href="/">← Back to status</Link>
        </nav>
      </header>

      <SubscribeForm categories={OZBARGAIN_CATEGORIES} />
    </div>
  )
}
