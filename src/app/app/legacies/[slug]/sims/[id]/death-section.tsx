'use client'

import { useState } from 'react'
import { CauseOfDeath } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { Button, Combobox } from '@/components/ui'
import styles from './page.module.css'

const CAUSE_OF_DEATH_OPTIONS: CauseOfDeath[] = [
  CauseOfDeath.OLD_AGE,
  CauseOfDeath.DROWNING,
  CauseOfDeath.FIRE,
  CauseOfDeath.ELECTROCUTION,
  CauseOfDeath.HUNGER,
  CauseOfDeath.OVEREXERTION,
  CauseOfDeath.EMBARRASSMENT,
  CauseOfDeath.ANGER,
  CauseOfDeath.LAUGHTER,
  CauseOfDeath.COWPLANT,
  CauseOfDeath.PUFFERFISH,
  CauseOfDeath.MURPHY_BED,
  CauseOfDeath.STEAM,
  CauseOfDeath.POISON,
  CauseOfDeath.METEOR,
]

function formatCause(cause: string): string {
  return cause.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Props {
  simId: string
  initialCauseOfDeath: CauseOfDeath | null
}

export function DeathSection({ simId, initialCauseOfDeath }: Props) {
  const update = trpc.sims.update.useMutation()
  const [causeOfDeath, setCauseOfDeath] = useState<CauseOfDeath | null>(initialCauseOfDeath)
  const [confirming, setConfirming] = useState(false)
  const [pendingCause, setPendingCause] = useState<CauseOfDeath>(CauseOfDeath.OLD_AGE)
  const [editingCause, setEditingCause] = useState(false)
  const [editCause, setEditCause] = useState<CauseOfDeath>(initialCauseOfDeath ?? CauseOfDeath.OLD_AGE)

  function handleConfirmDeath() {
    update.mutate(
      { id: simId, causeOfDeath: pendingCause },
      {
        onSuccess: () => {
          setCauseOfDeath(pendingCause)
          setConfirming(false)
        },
      },
    )
  }

  function handleChangeCause(newCause: CauseOfDeath) {
    update.mutate(
      { id: simId, causeOfDeath: newCause },
      {
        onSuccess: () => {
          setCauseOfDeath(newCause)
          setEditingCause(false)
        },
      },
    )
  }

  function handleMarkAlive() {
    update.mutate(
      { id: simId, causeOfDeath: null },
      { onSuccess: () => setCauseOfDeath(null) },
    )
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionLabel}>Death</h2>
        <div className={styles.sectionLine} />
      </div>

      {!causeOfDeath && !confirming && (
        <button className={styles.addChip} onClick={() => setConfirming(true)}>
          + Mark as deceased
        </button>
      )}

      {!causeOfDeath && confirming && (
        <div className={styles.deathConfirm}>
          <p className={styles.deathConfirmTitle}>Mark as deceased</p>
          <span className={styles.fieldLabel}>Cause of death</span>
          <Combobox
            value={pendingCause}
            onChange={(v) => setPendingCause(v as CauseOfDeath)}
            aria-label="Cause of death"
          >
            {CAUSE_OF_DEATH_OPTIONS.map((c) => (
              <Combobox.Item key={c} value={c}>{formatCause(c)}</Combobox.Item>
            ))}
          </Combobox>
          <div className={styles.deathConfirmActions}>
            <Button
              type="button"
              onClick={handleConfirmDeath}
              disabled={update.isPending}
            >
              Confirm
            </Button>
            <button
              className={styles.modalCancelBtn}
              type="button"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {causeOfDeath && (
        <div className={styles.deathCard}>
          <span className={styles.deathCardIcon} aria-hidden="true">✦</span>
          <div className={styles.deathCardMeta}>
            <span className={styles.fieldLabel}>Cause of death</span>
            {editingCause ? (
              <Combobox
                value={editCause}
                onChange={(v) => {
                  setEditCause(v as CauseOfDeath)
                  handleChangeCause(v as CauseOfDeath)
                }}
                aria-label="Cause of death"
              >
                {CAUSE_OF_DEATH_OPTIONS.map((c) => (
                  <Combobox.Item key={c} value={c}>{formatCause(c)}</Combobox.Item>
                ))}
              </Combobox>
            ) : (
              <p className={styles.deathCardCause}>{formatCause(causeOfDeath)}</p>
            )}
            <div className={styles.deathCardActions}>
              <button
                className={styles.deathCardLink}
                type="button"
                onClick={() => { setEditCause(causeOfDeath!); setEditingCause(true) }}
              >
                Change cause
              </button>
              <span className={styles.deathCardSep} aria-hidden="true">·</span>
              <button
                className={styles.deathCardLink}
                type="button"
                onClick={handleMarkAlive}
                disabled={update.isPending}
              >
                Mark as alive
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
