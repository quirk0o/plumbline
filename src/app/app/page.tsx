import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { countOwnedPacks } from '@/server/lib/packs/packReads'
import { listUserLegacies } from '@/server/lib/legacies/listUserLegacies'
import styles from './page.module.css'

export default async function DashboardPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/signin')

  const [ownedCount, legacies] = await Promise.all([
    countOwnedPacks(userId),
    listUserLegacies(userId),
  ])

  const firstName = session.user.name?.split(' ')[0] ?? null
  const greeting = firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'

  return (
    <div className={styles.page}>
      <h1 className={styles.greeting}>{greeting}</h1>

      <div className={styles.cards}>
        <Link href="/app/settings/packs" className={styles.card}>
          <div className={styles.cardLabel}>Your Packs</div>
          <div className={styles.cardValue}>{ownedCount} selected</div>
          <div className={styles.cardAction}>Manage →</div>
        </Link>
      </div>

      <section className={styles.legaciesSection}>
        <div className={styles.legaciesHeader}>
          <h2 className={styles.legaciesTitle}>Your Legacies</h2>
          <Link href="/app/legacies/new" className={styles.startLegacyLink}>
            + Start a legacy
          </Link>
        </div>

        {legacies.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No legacies yet.</p>
            <Link href="/app/legacies/new" className={styles.emptyLink}>
              Start your first legacy →
            </Link>
          </div>
        ) : (
          <ul className={styles.legacyList}>
            {legacies.map((legacy) => {
              const founder = legacy.founderSim
              const founderName =
                founder
                  ? [founder.firstName, founder.lastName].filter(Boolean).join(' ')
                  : null
              return (
                <li key={legacy.id}>
                  <Link
                    href={`/app/legacies/${legacy.slug}`}
                    className={styles.legacyCard}
                  >
                    <div className={styles.legacyMeta}>
                      <span className={styles.legacyName}>{legacy.name}</span>
                      {founderName && (
                        <span className={styles.founderLine}>
                          Founded by {founderName}
                        </span>
                      )}
                    </div>
                    <span className={styles.legacyArrow}>→</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
