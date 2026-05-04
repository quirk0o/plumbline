import Link from 'next/link'
import { auth } from '../../../../../auth'
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

export default async function OnboardingPacksPage() {
  const session = await auth()
  const userId = session!.user.id

  const packs = await db.pack.findMany({
    where: { type: { not: PackType.BASE_GAME } },
    include: { userPacks: { where: { userId } } },
    orderBy: { name: 'asc' },
  })

  const grouped = PACK_TYPE_ORDER.map(type => ({
    type,
    packs: packs
      .filter(p => p.type === type)
      .map(({ userPacks, createdAt: _ca, updatedAt: _ua, ...p }) => ({
        ...p,
        isOwned: userPacks.length > 0,
      })),
  })).filter(g => g.packs.length > 0)

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
