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
import { PinnedMilestoneRow } from './pinned-milestone-row'
import { SortableMilestoneRow } from './sortable-milestone-row'
import { MilestoneComposer } from './milestone-composer'
import styles from './milestones.module.css'

export interface MilestonesClientProps {
  milestones: Milestone[]
  simsById: Record<string, ChronicleSim>
  slug: string
  legacyId: string
}

/**
 * Compute the reorder neighbours for a row at `pos` in a newest-first list.
 * "prev" is the row above (higher sortOrder); "next" is the row below (lower
 * sortOrder). Exported for unit testing the drag math without simulating an
 * actual @dnd-kit drag in jsdom.
 */
export function neighborSortOrders(
  items: Milestone[],
  pos: number,
): { prevSortOrder: number | undefined; nextSortOrder: number | undefined } {
  return {
    prevSortOrder: items[pos - 1]?.sortOrder,
    nextSortOrder: items[pos + 1]?.sortOrder,
  }
}

/**
 * Content-aware signature of the server list. Changes whenever a row's id,
 * order, sortOrder, or title changes — so an EDIT (same ids, new title) still
 * remounts the inner list and reconciles, fixing the stale-title bug.
 */
function signatureOf(milestones: Milestone[]): string {
  return milestones.map((m) => `${m.id}:${m.sortOrder}:${m.title}`).join('|')
}

interface MilestonesListProps {
  initialMilestones: Milestone[]
  simsById: Record<string, ChronicleSim>
  slug: string
  legacyId: string
}

/**
 * The interactive list. Its local `items` state is seeded from props and only
 * diverges optimistically (drag / delete). The parent remounts it (via a
 * content-aware `key`) whenever the server data changes, so a fresh mount
 * always reconciles to the latest server truth.
 */
function MilestonesList({ initialMilestones, simsById, slug, legacyId }: MilestonesListProps) {
  const router = useRouter()
  const [items, setItems] = useState<Milestone[]>(initialMilestones)
  const [editing, setEditing] = useState<Milestone | null>(null)

  const reorder = trpc.milestones.reorder.useMutation()
  const remove = trpc.milestones.delete.useMutation()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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

    const pos = next.findIndex((m) => m.id === moved.id)
    const { prevSortOrder, nextSortOrder } = neighborSortOrders(next, pos)

    try {
      await reorder.mutateAsync({ id: moved.id, prevSortOrder, nextSortOrder })
    } finally {
      // Pull the true server order back — reconciles success, reverts failure.
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((m) => m.id !== id))
    try {
      await remove.mutateAsync({ id })
    } finally {
      // On failure this restores the deleted row; on success it's a no-op.
      router.refresh()
    }
  }

  return (
    <div>
      <MilestoneComposer
        legacyId={legacyId}
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
            <ul className={styles.rows} role="list">
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
                  <PinnedMilestoneRow
                    key={m.id}
                    milestone={m}
                    simsById={simsById}
                    slug={slug}
                  />
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

export function MilestonesClient({ milestones, simsById, slug, legacyId }: MilestonesClientProps) {
  // Remount the interactive list whenever the server data's content signature
  // changes (covers reorders, deletes, AND edits where ids are unchanged).
  return (
    <MilestonesList
      key={signatureOf(milestones)}
      initialMilestones={milestones}
      simsById={simsById}
      slug={slug}
      legacyId={legacyId}
    />
  )
}
