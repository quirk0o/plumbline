import { redirect } from 'next/navigation'
import { auth } from '../../../../auth'
import { db } from '@/server/db'
import { PackType } from '@prisma/client'
import { PackGrid } from '@/app/components/PackGrid'
import styles from './page.module.css'

const PACK_TYPE_ORDER: PackType[] = [
  PackType.EXPANSION,
  PackType.GAME_PACK,
  PackType.STUFF_PACK,
  PackType.KIT,
]

export default async function SettingsPacksPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin')

  const userId = session.user.id!
  const packs = await db.pack.findMany({
    where: { type: { not: PackType.BASE_GAME } },
    include: { userPacks: { where: { userId } } },
    orderBy: { name: 'asc' },
  })

  const grouped = PACK_TYPE_ORDER.map(type => ({
    type,
    packs: packs
      .filter(p => p.type === type)
      .map(({ userPacks, createdAt: _ca, updatedAt: _ua, ...p }) => ({ ...p, isOwned: userPacks.length > 0 })),
  })).filter(g => g.packs.length > 0)

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
