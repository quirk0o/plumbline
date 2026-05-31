import { SectionHeading, EmptyState } from '@/components/ui'
import type { Milestone, ChronicleSim } from '../../lib/types'
import { MilestoneRow } from './milestone-row'
import styles from './milestones.module.css'

export interface MilestonesProps {
  milestones: Milestone[]
  simsById: Record<string, ChronicleSim>
  slug: string
}

export function Milestones({ milestones, simsById, slug }: MilestonesProps) {
  return (
    <div className={styles.container}>
      <SectionHeading
        eyebrow="Chronicle"
        title="Milestones"
        blurb="Births, marriages, and the moments in between."
      />

      {milestones.length === 0 ? (
        <EmptyState>No milestones recorded yet.</EmptyState>
      ) : (
        <ul className={styles.rows}>
          {milestones.map((milestone) => (
            <MilestoneRow
              key={milestone.id}
              milestone={milestone}
              simsById={simsById}
              slug={slug}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
