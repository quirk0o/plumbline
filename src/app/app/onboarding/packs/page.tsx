import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { PackGrid } from '@/app/components/pack-grid'
import { getPacksForUser } from '@/server/lib/packs/packReads'
import { ButtonLink } from '@/components/ui'
import styles from './page.module.css'

export default async function OnboardingPacksPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/signin')

  const grouped = await getPacksForUser(userId)

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
        <ButtonLink href="/app" variant="primary" size="sm">Continue →</ButtonLink>
        <ButtonLink href="/app" variant="link" size="sm">Skip for now</ButtonLink>
      </div>
    </div>
  )
}
