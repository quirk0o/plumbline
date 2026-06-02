import {
  SectionHeading,
  GenerationBadge,
  ButtonLink,
  EmptyState,
  UsersIcon,
  ArrowRightIcon,
} from '@/components/ui'
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
          icon={<UsersIcon size={24} />}
          title={
            <>
              No Sims <em style={{ color: 'var(--green)' }}>named</em> yet.
            </>
          }
          action={
            <ButtonLink
              variant="primary"
              size="sm"
              href={`/app/legacies/${slug}/sims/new`}
            >
              Add your founder <ArrowRightIcon size={16} />
            </ButtonLink>
          }
        >
          Your founder is the first name in the register. Everyone after
          follows from them.
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
