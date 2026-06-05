import Link from 'next/link'
import { ButtonLink, Card, EmptyState, FeatherIcon } from '@/components/ui'
import type { ChallengeTab } from '@/server/lib/challengeBrowse'
import { OwnershipBadge } from './ownership-badge'
import styles from './challenge-grid.module.css'

export interface ChallengeGridItem {
  id: string
  name: string
  description: string | null
  isYours: boolean
  phaseCount: number
}

interface ChallengeGridProps {
  challenges: ChallengeGridItem[]
  tab: ChallengeTab
  query: string
}

const EMPTY_COPY: Record<ChallengeTab, string> = {
  all: 'Public challenges will appear here as they are added.',
  mine: "You haven't created any challenges yet.",
  public: 'No public challenges have been shared yet.',
}

function clearSearchHref(tab: ChallengeTab): string {
  return tab === 'all' ? '/app/challenges' : `/app/challenges?tab=${tab}`
}

export function ChallengeGrid({ challenges, tab, query }: ChallengeGridProps) {
  if (challenges.length === 0 && query) {
    return (
      <EmptyState
        icon={<FeatherIcon size={28} />}
        title={<>No challenges match &ldquo;{query}&rdquo;</>}
        action={
          <ButtonLink variant="outline" size="sm" href={clearSearchHref(tab)}>
            Clear search
          </ButtonLink>
        }
      >
        Try a different name, or browse the full library.
      </EmptyState>
    )
  }

  if (challenges.length === 0) {
    return (
      <EmptyState icon={<FeatherIcon size={28} />} title="No challenges here yet">
        {EMPTY_COPY[tab]}
      </EmptyState>
    )
  }

  return (
    <ul className={styles.grid}>
      {challenges.map((challenge) => (
        <li key={challenge.id}>
          <Link href={`/app/challenges/${challenge.id}`} className={styles.cardLink}>
            <Card as="article" hoverable className={styles.card}>
              <h3 className={styles.name}>{challenge.name}</h3>
              {challenge.description && (
                <p className={styles.description}>{challenge.description}</p>
              )}
              <div className={styles.meta}>
                <span className={styles.phaseCount}>
                  {challenge.phaseCount} {challenge.phaseCount === 1 ? 'phase' : 'phases'}
                </span>
                <OwnershipBadge isYours={challenge.isYours} />
              </div>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  )
}
