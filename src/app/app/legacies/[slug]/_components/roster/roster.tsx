import { SectionHeading, GenerationBadge, ButtonLink, EmptyState } from '@/components/ui'
import { roman } from '@/lib/legacy-format'
import type { RosterGroup } from '../../lib/types'
import { RosterCard } from './roster-card'
import styles from './roster.module.css'

export interface RosterProps {
  groups: RosterGroup[]
  slug: string
}

export function Roster({ groups, slug }: RosterProps) {
  return (
    <div className={styles.container}>
      {/* Top row: section heading + "Add sim" button */}
      <div className={styles.topRow}>
        <div className={styles.headingWrapper}>
          <SectionHeading
            eyebrow="Family"
            title="All sims"
            blurb="Every soul this legacy has known."
          />
        </div>
        <ButtonLink
          variant="outline"
          size="sm"
          href={`/app/legacies/${slug}/sims/new`}
          className={styles.addSimButton}
        >
          Add sim
        </ButtonLink>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          action={
            <ButtonLink
              variant="outline"
              size="sm"
              href={`/app/legacies/${slug}/sims/new`}
            >
              Add your first sim →
            </ButtonLink>
          }
        >
          No sims yet.
        </EmptyState>
      ) : (
        /* One group per generation */
        groups.map((group) => (
          <div key={group.gen ?? 'unassigned'} className={styles.group}>
            <div className={styles.groupHeader}>
              <GenerationBadge>
                {group.gen !== null ? `Gen ${roman(group.gen)}` : 'Unassigned'}
              </GenerationBadge>
              <span className={styles.groupCount}>
                {group.sims.length} {group.sims.length === 1 ? 'sim' : 'sims'}
              </span>
            </div>
            <ul className={styles.grid}>
              {group.sims.map((sim) => (
                <RosterCard key={sim.id} sim={sim} slug={slug} />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
