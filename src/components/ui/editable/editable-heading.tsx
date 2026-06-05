'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import styles from './editable.module.css'

export interface EditableHeadingProps {
  value: string
  onCommit: (value: string) => void
  /** Open directly in edit mode (e.g. right after founding a household). */
  autoEdit?: boolean
  'aria-label': string
  className?: string
}

/** Serif display heading with the dashed-green click-to-edit affordance.
 *  Commits trimmed, non-empty, changed values on blur/Enter; Esc cancels. */
export function EditableHeading({
  value,
  onCommit,
  autoEdit = false,
  'aria-label': ariaLabel,
  className,
}: EditableHeadingProps) {
  const [editing, setEditing] = useState(autoEdit)
  const [draft, setDraft] = useState(value)

  function startEditing() {
    setDraft(value)
    setEditing(true)
  }

  function commit() {
    const v = draft.trim()
    if (v && v !== value) onCommit(v)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        className={cn(styles.heading, styles.headingInput, className)}
        value={draft}
        autoFocus
        aria-label={ariaLabel}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <h2 className={cn(styles.heading, className)}>
      <button
        type="button"
        className={styles.displayButton}
        title="Click to rename"
        onClick={startEditing}
      >
        {value}
      </button>
    </h2>
  )
}
