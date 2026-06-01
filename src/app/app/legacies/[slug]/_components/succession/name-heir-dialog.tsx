'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  PortraitAvatar,
  GhostCircle,
  ButtonLink,
  UserPlusIcon,
} from '@/components/ui'
import { trpc } from '@/trpc/client'
import type { ChronicleSim } from '../../lib/types'
import styles from './name-heir-dialog.module.css'

export interface NameHeirDialogProps {
  slug: string
  /** Tracked-uppercase label for the generation being named, e.g. "Gen II". */
  nextHeirLabel: string
  /** Sims that can be designated — the founder is excluded by the caller. */
  candidates: ChronicleSim[]
}

/**
 * The "Name an heir" ghost slot in the succession line. Clicking it opens a
 * dialog to pick a sim and designate them heir in place — no navigation. The
 * server clears any previous heir in that sim's generation.
 */
export function NameHeirDialog({
  slug,
  nextHeirLabel,
  candidates,
}: NameHeirDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const update = trpc.sims.update.useMutation()

  async function choose(id: string) {
    setError('')
    try {
      await update.mutateAsync({ id, isHeir: true })
      setOpen(false)
      router.refresh()
    } catch {
      setError('Could not name the heir. Please try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={styles.trigger}>
          <GhostCircle size={72} accent>
            <UserPlusIcon size={20} />
          </GhostCircle>
          <span className={styles.triggerName}>Name an heir</span>
          <span className={styles.triggerRole}>{nextHeirLabel}</span>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content size="sm">
          <Dialog.Title>Name an heir</Dialog.Title>
          <Dialog.Description>
            Choose who carries the legacy into {nextHeirLabel}.
          </Dialog.Description>

          {candidates.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>
                There&rsquo;s no one to name yet — add a sim to the legacy
                first.
              </p>
              <ButtonLink
                variant="primary"
                size="sm"
                href={`/app/legacies/${slug}/sims/new`}
              >
                Add a Sim
              </ButtonLink>
            </div>
          ) : (
            <ul className={styles.list}>
              {candidates.map((sim) => (
                <li key={sim.id}>
                  <button
                    type="button"
                    className={styles.candidate}
                    onClick={() => choose(sim.id)}
                    disabled={update.isPending}
                  >
                    <PortraitAvatar
                      imageUrl={sim.imageUrl}
                      firstName={sim.firstName}
                      lastName={sim.lastName}
                      size={40}
                    />
                    <span className={styles.candidateName}>
                      {sim.firstName} {sim.lastName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <Dialog.Close asChild>
              <button type="button" className={styles.cancel}>
                Cancel
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
