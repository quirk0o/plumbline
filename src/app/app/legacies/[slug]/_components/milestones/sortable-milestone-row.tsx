'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Milestone, ChronicleSim } from '../../lib/types'
import { MilestoneRow } from './milestone-row'
import styles from './sortable-milestone-row.module.css'

export interface SortableMilestoneRowProps {
  milestone: Milestone
  simsById: Record<string, ChronicleSim>
  slug: string
  onEdit: () => void
  onDelete: () => void
}

export function SortableMilestoneRow({
  milestone, simsById, slug, onEdit, onDelete,
}: SortableMilestoneRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: milestone.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={styles.wrapper} data-testid="sortable-milestone">
      <button
        type="button"
        className={styles.handle}
        aria-label={`Reorder ${milestone.title}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <MilestoneRow milestone={milestone} simsById={simsById} slug={slug} />
      <div className={styles.controls}>
        <button type="button" onClick={onEdit} aria-label={`Edit ${milestone.title}`}>Edit</button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${milestone.title}`}>Delete</button>
      </div>
    </div>
  )
}
