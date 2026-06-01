'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { trpc } from '@/trpc/client'
import type { Milestone, ChronicleSim } from '../../lib/types'
import { MilestoneRow } from './milestone-row'
import { SortableMilestoneRow } from './sortable-milestone-row'
import { MilestoneComposer } from './milestone-composer'
import styles from './milestones.module.css'

export interface MilestonesClientProps {
  milestones: Milestone[]
  simsById: Record<string, ChronicleSim>
  slug: string
  legacyId: string
}

export function MilestonesClient({ milestones, simsById, slug, legacyId }: MilestonesClientProps) {
  const router = useRouter()
  const [items, setItems] = useState<Milestone[]>(milestones)
  const [editing, setEditing] = useState<Milestone | null>(null)

  const reorder = trpc.milestones.reorder.useMutation()
  const remove = trpc.milestones.delete.useMutation()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Keep in sync if the server data changes (after router.refresh()).
  if (milestones !== items && milestones.map((m) => m.id).join() !== items.map((m) => m.id).join()) {
    setItems(milestones)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((m) => m.id === active.id)
    const newIndex = items.findIndex((m) => m.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    // Optimistic reorder
    const next = [...items]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved)
    setItems(next)

    // Neighbors in the new ordering (newest-first list): prev = above (higher
    // sortOrder), nextRow = below (lower sortOrder).
    const pos = next.findIndex((m) => m.id === moved.id)
    const prev = next[pos - 1]
    const below = next[pos + 1]
    await reorder.mutateAsync({
      id: moved.id,
      prevSortOrder: prev?.sortOrder,
      nextSortOrder: below?.sortOrder,
    })
    router.refresh()
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((m) => m.id !== id))
    await remove.mutateAsync({ id })
    router.refresh()
  }

  return (
    <div>
      <MilestoneComposer
        legacyId={legacyId}
        slug={slug}
        simsById={simsById}
        editing={editing}
        onDone={() => {
          setEditing(null)
          router.refresh()
        }}
        onCancelEdit={() => setEditing(null)}
      />

      {items.length === 0 ? null : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <ul className={styles.rows}>
              {items.map((m) =>
                m.userAuthored ? (
                  <SortableMilestoneRow
                    key={m.id}
                    milestone={m}
                    simsById={simsById}
                    slug={slug}
                    onEdit={() => setEditing(m)}
                    onDelete={() => handleDelete(m.id)}
                  />
                ) : (
                  <MilestoneRow key={m.id} milestone={m} simsById={simsById} slug={slug} />
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
