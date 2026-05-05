import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { PackGrid } from '@/app/components/pack-grid'
import { fetchPacksForUser } from '@/lib/packs'
import styles from './page.module.css'

export default async function SettingsPacksPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/signin')

  const grouped = await fetchPacksForUser(userId, db)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your Packs</h1>
        <p className={styles.subtitle}>Update your collection anytime. Changes save automatically.</p>
      </header>

      <PackGrid initialGroups={grouped} />
    </div>
  )
}
