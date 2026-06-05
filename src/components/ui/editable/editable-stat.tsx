'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import styles from './editable.module.css'

export interface EditableStatProps {
  value: number
  label: string
  onCommit: (value: number) => void
  /** Green numeral (funds). */
  green?: boolean
  className?: string
}

/** §-prefixed serif numeral with the dashed-edit affordance; numeric input on
 *  click. Strips non-digits; empty/invalid reverts without committing. */
export function EditableStat({ value, label, onCommit, green = false, className }: EditableStatProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  function startEditing() {
    setDraft(String(value))
    setEditing(true)
  }

  function commit() {
    const n = parseInt(draft.replace(/[^0-9]/g, ''), 10)
    if (!Number.isNaN(n) && n !== value) onCommit(n)
    setEditing(false)
  }

  const valueClass = cn(styles.statValue, green && styles.statValueGreen)

  return (
    <div className={cn(styles.stat, className)}>
      <div className={styles.statValueRow}>
        {editing ? (
          <span className={cn(valueClass, styles.statInputWrap)}>
            <span className={styles.statPrefix}>§</span>
            <input
              className={styles.statInput}
              value={draft}
              autoFocus
              inputMode="numeric"
              aria-label={label}
              style={{ width: `${Math.min(8, Math.max(3, draft.replace(/[^0-9]/g, '').length))}ch` }}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') {
                  setDraft(String(value))
                  setEditing(false)
                }
              }}
            />
          </span>
        ) : (
          <span className={valueClass}>
            <button
              type="button"
              className={styles.displayButton}
              aria-label={`Edit ${label}`}
              title="Click to edit"
              onClick={startEditing}
            >
              {'§' + value.toLocaleString('en-US')}
            </button>
          </span>
        )}
      </div>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
