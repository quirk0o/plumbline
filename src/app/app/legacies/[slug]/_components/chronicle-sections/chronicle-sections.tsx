import type {
  ChronicleSim,
  LegacyStats,
  Milestone,
  RosterGroup,
  SuccessionStep,
} from '../../lib/types'
import { Hero } from '../hero/hero'
import { Succession } from '../succession/succession'
import { Milestones } from '../milestones/milestones'
import { Roster } from '../roster/roster'
import styles from './chronicle-sections.module.css'

export interface ChronicleSectionsProps {
  name: string
  description: string | null
  slug: string
  stats: LegacyStats
  founder: ChronicleSim | null
  currentHeir: ChronicleSim | null
  succession: SuccessionStep[]
  milestones: Milestone[]
  simsById: Record<string, ChronicleSim>
  groups: RosterGroup[]
  treeSlot: React.ReactNode
}

/**
 * Synchronous, presentational layout of the four chronicle sections.
 *
 * Extracted from the async page so the section markup, backgrounds, and
 * padding can be unit-tested without auth/db. Each `<section>` carries an
 * `id` + `data-section` that the SectionNav's IntersectionObserver tracks.
 */
export function ChronicleSections({
  name,
  description,
  slug,
  stats,
  founder,
  currentHeir,
  succession,
  milestones,
  simsById,
  groups,
  treeSlot,
}: ChronicleSectionsProps) {
  return (
    <div className={styles.column}>
      <section id="hero" data-section="hero" aria-label="Overview" className={styles.heroSection}>
        <div className={styles.inner}>
          <Hero
            name={name}
            description={description}
            slug={slug}
            stats={stats}
            founder={founder}
            currentHeir={currentHeir}
            treeSlot={treeSlot}
          />
        </div>
      </section>

      <section
        id="succession"
        data-section="succession"
        aria-label="Succession"
        className={styles.cardSection}
      >
        <div className={styles.inner}>
          <Succession steps={succession} slug={slug} />
        </div>
      </section>

      <section
        id="milestones"
        data-section="milestones"
        aria-label="Milestones"
        className={styles.cardSection}
      >
        <div className={styles.inner}>
          <Milestones milestones={milestones} simsById={simsById} slug={slug} />
        </div>
      </section>

      <section
        id="sims"
        data-section="sims"
        data-testid="roster"
        aria-label="Sims"
        className={styles.rosterSection}
      >
        <div className={styles.inner}>
          <Roster groups={groups} slug={slug} />
        </div>
      </section>
    </div>
  )
}
