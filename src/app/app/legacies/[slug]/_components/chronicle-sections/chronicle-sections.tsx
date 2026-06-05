import type {
  ChronicleSim,
  HouseholdSim,
  HouseholdView,
  LegacyStats,
  Milestone,
  RosterGroup,
  SuccessionStep,
  WorldOption,
} from '../../lib/types'
import { Hero } from '../hero/hero'
import { Succession } from '../succession/succession'
import { HouseholdsSection } from '../households/households-section'
import { Milestones } from '../milestones/milestones'
import { Roster } from '../roster/roster'
import styles from './chronicle-sections.module.css'

export interface ChronicleSectionsProps {
  name: string
  description: string | null
  slug: string
  legacyId: string
  stats: LegacyStats
  founder: ChronicleSim | null
  currentHeir: ChronicleSim | null
  succession: SuccessionStep[]
  households: HouseholdView[]
  worlds: WorldOption[]
  householdSims: HouseholdSim[]
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
  legacyId,
  stats,
  founder,
  currentHeir,
  succession,
  households,
  worlds,
  householdSims,
  milestones,
  simsById,
  groups,
  treeSlot,
}: ChronicleSectionsProps) {
  return (
    <div className={styles.column}>
      <section id="hero" data-section="hero" data-testid="section-hero" aria-label="Overview" className={styles.heroSection}>
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
        data-testid="section-succession"
        aria-label="Succession"
        className={styles.cardSection}
      >
        <div className={styles.inner}>
          <Succession
            steps={succession}
            slug={slug}
            sims={Object.values(simsById)}
          />
        </div>
      </section>

      <section
        id="households"
        data-section="households"
        data-testid="households"
        aria-label="Households"
        className={styles.cardSection}
      >
        <div className={styles.inner}>
          <HouseholdsSection
            legacyId={legacyId}
            households={households}
            worlds={worlds}
            sims={householdSims}
          />
        </div>
      </section>

      <section
        id="milestones"
        data-section="milestones"
        data-testid="section-milestones"
        aria-label="Milestones"
        className={styles.cardSection}
      >
        <div className={styles.inner}>
          <Milestones milestones={milestones} simsById={simsById} slug={slug} legacyId={legacyId} />
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
