import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { PackGrid } from '@/app/components/PackGrid'
import { fetchPacksForUser } from '@/lib/packs'
import styles from './page.module.css'

export default async function OnboardingPacksPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/signin')

  const grouped = await fetchPacksForUser(userId, db)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.stepLabel}>Onboarding · Step 1</p>
        <h1 className={styles.title}>Which packs do you own?</h1>
        <p className={styles.subtitle}>
          Tap a pack to add it. We&apos;ll only show content from your collection.
        </p>
      </header>

      <PackGrid initialGroups={grouped} />

      <div className={styles.ctaRow}>
        <Link href="/app" className={styles.btnContinue}>
          Continue →
        </Link>
        <Link href="/app" className={styles.btnSkip}>
          Skip for now
        </Link>
      </div>
    </div>
  )
}
