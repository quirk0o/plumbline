import { auth } from '../../../../../auth'
import { db } from '@/server/db'
import { PackGrid } from '@/app/components/PackGrid'
import { fetchPacksForUser } from '@/lib/packs'
import styles from './page.module.css'

export default async function SettingsPacksPage() {
  const session = await auth()
  const userId = session!.user.id

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
