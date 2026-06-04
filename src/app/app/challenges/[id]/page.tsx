import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { getChallengeForView } from '@/server/lib/challengeBrowse'
import { OwnershipBadge } from '../_components/ownership-badge'
import { PhaseList } from './_components/phase-list'
import { StartRunDialog } from './_components/start-run-dialog'
import styles from './page.module.css'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ChallengeDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/auth/signin')

  // Unknown id and private-but-not-yours both 404 — private ids leak nothing.
  const challenge = await getChallengeForView(userId, id)
  if (!challenge) notFound()

  const legacies = await db.legacy.findMany({
    where: { userId },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  })

  const phaseCount = challenge.phases.length

  return (
    <div className={styles.page}>
      <Link href="/app/challenges" className={styles.backLink}>
        ← All challenges
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{challenge.name}</h1>
          <div className={styles.meta}>
            <OwnershipBadge isYours={challenge.ownerId === userId} />
            <span className={styles.phaseCount}>
              {phaseCount} {phaseCount === 1 ? 'phase' : 'phases'}
            </span>
          </div>
        </div>
        <StartRunDialog
          challengeId={challenge.id}
          challengeName={challenge.name}
          legacies={legacies}
        />
      </header>

      {challenge.description && (
        <p className={styles.description}>{challenge.description}</p>
      )}

      <PhaseList phases={challenge.phases} />
    </div>
  )
}
