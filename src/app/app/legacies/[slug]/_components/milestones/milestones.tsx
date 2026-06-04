import type { Milestone, ChronicleSim } from '../../lib/types'
import { MilestonesClient } from './milestones-client'
import styles from './milestones.module.css'

export interface MilestonesProps {
  milestones: Milestone[]
  simsById: Record<string, ChronicleSim>
  slug: string
  legacyId: string
}

export function Milestones({ milestones, simsById, slug, legacyId }: MilestonesProps) {
  return (
    <div className={styles.container}>
      <MilestonesClient
        milestones={milestones}
        simsById={simsById}
        slug={slug}
        legacyId={legacyId}
      />
    </div>
  )
}
