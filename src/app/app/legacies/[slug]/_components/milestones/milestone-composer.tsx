'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import { Button, Drawer, Eyebrow } from '@/components/ui'
import type { Milestone, ChronicleSim } from '../../lib/types'
import { SimTagChips } from './sim-tag-chips'
import styles from './milestone-composer.module.css'

export interface MilestoneComposerProps {
  legacyId: string
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
  /** Cancel without persisting. */
  onCancel: () => void
}

/** Inner stateful form rendered inside the drawer. Key-remounted when `editing`
 *  changes so its state resets cleanly per open. */
function ComposerForm({ legacyId, simsById, editing, onDone, onCancel }: ComposerFormProps) {
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

  function toggleSim(id: string) {
    setSimIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const allSims = Object.values(simsById)

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Eyebrow>Record a moment</Eyebrow>
          <Drawer.Close className={styles.close} aria-label="Close">✕</Drawer.Close>
        </div>
        <Drawer.Title className={styles.headerTitle}>
          {isEditing ? 'Edit milestone' : 'New milestone'}
        </Drawer.Title>
      </header>

      <div className={styles.body}>
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
            rows={4}
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="Tell the story in your own words…"
          />
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Tag the sims involved</span>
          <SimTagChips sims={allSims} value={simIds} onToggle={toggleSim} />
        </div>
      </div>

      <footer className={styles.footer}>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" onClick={handleSave} disabled={title.trim().length === 0 || pending}>
          Save milestone
        </Button>
      </footer>
    </>
  )
}

export function MilestoneComposer({
  legacyId, simsById, editing, onDone, onCancelEdit,
}: MilestoneComposerProps) {
  const [open, setOpen] = useState(false)
  const showForm = open || editing !== null

  function handleOpenChange(next: boolean) {
    if (!next) {
      setOpen(false)
      // Editing: clear the parent's editing target. A brand-new unsaved note
      // just closes — no router.refresh().
      if (editing !== null) onCancelEdit()
    }
  }

  return (
    <>
      <div className={styles.trigger}>
        <span className={styles.triggerText}>Record a moment of your own.</span>
        <Button type="button" onClick={() => setOpen(true)}>+ Add milestone</Button>
      </div>

      <Drawer open={showForm} onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay />
          <Drawer.Content side="right" aria-describedby={undefined}>
            <ComposerForm
              key={editing?.id ?? 'new'}
              legacyId={legacyId}
              simsById={simsById}
              editing={editing}
              onDone={() => {
                setOpen(false)
                onDone()
              }}
              onCancel={() => handleOpenChange(false)}
            />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer>
    </>
  )
}
