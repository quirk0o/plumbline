'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Milestone, ChronicleSim } from '../../lib/types'
import { MilestoneRowContent } from './milestone-row'
import styles from './sortable-milestone-row.module.css'

export interface PinnedMilestoneRowProps {
  milestone: Milestone
  simsById: Record<string, ChronicleSim>
  slug: string
}

/**
 * An auto-derived (non-draggable) milestone row. It still registers with
 * @dnd-kit via `useSortable({ disabled: true })` so it acts as a layout/drop
 * anchor — a user-authored Note can be dropped between two auto rows — while
 * never being picked up itself (no drag handle, `disabled: true`).
 */
export function PinnedMilestoneRow({ milestone, simsById, slug }: PinnedMilestoneRowProps) {
  const { setNodeRef, transform, transition } = useSortable({
    id: milestone.id,
    disabled: true,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li ref={setNodeRef} style={style} className={styles.pinned}>
      <div className={styles.content}>
        <MilestoneRowContent milestone={milestone} simsById={simsById} slug={slug} />
      </div>
    </li>
  )
}
