import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '../../../auth'
import { db } from '@/server/db'
import { PackType } from '@prisma/client'
import styles from './page.module.css'

export default async function DashboardPage() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/signin')

  const ownedCount = await db.userPack.count({
    where: { userId, pack: { type: { not: PackType.BASE_GAME } } },
  })

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

      <p className={styles.placeholder}>Your legacies will appear here.</p>
    </div>
  )
}
