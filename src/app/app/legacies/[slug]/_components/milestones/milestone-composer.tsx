'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import { Button } from '@/components/ui'
import type { Milestone, ChronicleSim } from '../../lib/types'
import styles from './milestone-composer.module.css'

export interface MilestoneComposerProps {
  legacyId: string
  slug: string
  simsById: Record<string, ChronicleSim>
  /** When set, the composer opens pre-filled to edit this milestone. */
  editing: Milestone | null
  onDone: () => void
  onCancelEdit: () => void
}

interface ComposerFormProps {
  legacyId: string
  simsById: Record<string, ChronicleSim>
  editing: Milestone | null
  onDone: () => void
  onCancelEdit: () => void
}

/** Inner stateful form — key-remounted when editing changes to reset state cleanly. */
function ComposerForm({ legacyId, simsById, editing, onDone, onCancelEdit }: ComposerFormProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  const [blurb, setBlurb] = useState(editing?.blurb ?? '')
  const [simIds, setSimIds] = useState<string[]>(editing?.simIds ?? [])

  const create = trpc.milestones.create.useMutation()
  const update = trpc.milestones.update.useMutation()
  const isEditing = editing !== null
  const pending = create.isPending || update.isPending

  async function handleSave() {
    if (title.trim().length === 0) return
    if (isEditing && editing) {
      await update.mutateAsync({ id: editing.id, title: title.trim(), blurb: blurb.trim() || undefined, simIds })
    } else {
      await create.mutateAsync({ legacyId, title: title.trim(), blurb: blurb.trim() || undefined, simIds })
    }
    onDone()
  }

  function handleCancel() {
    if (isEditing) onCancelEdit()
    else onDone()
  }

  const allSims = Object.values(simsById)

  return (
    <div className={styles.composer}>
      <label className={styles.field}>
        <span className={styles.label}>Title</span>
        <input
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Caliente–Lothario feud begins"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Story</span>
        <textarea
          className={styles.textarea}
          rows={3}
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          placeholder="Tell the story in your own words…"
        />
      </label>

      <fieldset className={styles.tags}>
        <legend className={styles.label}>Tag sims</legend>
        {allSims.map((s) => {
          const checked = simIds.includes(s.id)
          return (
            <label key={s.id} className={styles.tag}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  setSimIds((prev) =>
                    e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                  )
                }
              />
              {s.firstName} {s.lastName}
            </label>
          )
        })}
      </fieldset>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={handleCancel}>Cancel</Button>
        <Button type="button" onClick={handleSave} disabled={title.trim().length === 0 || pending}>
          Save milestone
        </Button>
      </div>
    </div>
  )
}

export function MilestoneComposer({
  legacyId, slug: _slug, simsById, editing, onDone, onCancelEdit,
}: MilestoneComposerProps) {
  const [open, setOpen] = useState(false)

  // When the parent sets an editing milestone, open the form.
  // The `key` on ComposerForm resets its internal state when editing changes.
  const showForm = open || editing !== null

  if (!showForm) {
    return (
      <div className={styles.trigger}>
        <span className={styles.triggerText}>Record a moment</span>
        <Button type="button" onClick={() => setOpen(true)}>+ Add milestone</Button>
      </div>
    )
  }

  return (
    <ComposerForm
      key={editing?.id ?? 'new'}
      legacyId={legacyId}
      simsById={simsById}
      editing={editing}
      onDone={() => {
        setOpen(false)
        onDone()
      }}
      onCancelEdit={() => {
        setOpen(false)
        onCancelEdit()
      }}
    />
  )
}
