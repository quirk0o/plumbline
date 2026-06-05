'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import styles from './editable.module.css'

export interface EditableTextProps {
  value: string
  onCommit: (value: string) => void
  multiline?: boolean
  placeholder?: string
  'aria-label': string
  className?: string
}

/** Body-text inline edit. Single-line commits on Enter; multiline commits on
 *  Enter (Shift+Enter inserts a newline). Blur commits; Esc cancels. Empty
 *  values ARE committed (clearing a description is a real edit); shows an
 *  italic placeholder when empty. */
export function EditableText({
  value,
  onCommit,
  multiline = false,
  placeholder = 'Add a note…',
  'aria-label': ariaLabel,
  className,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function startEditing() {
    setDraft(value)
    setEditing(true)
  }

  function commit() {
    const v = draft.trim()
    if (v !== value) onCommit(v)
    setEditing(false)
  }

  if (editing) {
    const shared = {
      value: draft,
      autoFocus: true,
      'aria-label': ariaLabel,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
    }
    if (multiline) {
      return (
        <textarea
          {...shared}
          rows={1}
          className={cn(styles.body, styles.bodyInput, styles.bodyTextarea, className)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              commit()
            }
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
        />
      )
    }
    return (
      <input
        {...shared}
        className={cn(styles.body, styles.bodyInput, className)}
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

  const empty = value.trim().length === 0
  return (
    <span className={cn(styles.body, empty && styles.bodyEmpty, className)}>
      <button
        type="button"
        className={styles.displayButton}
        title="Click to edit"
        onClick={startEditing}
      >
        {empty ? placeholder : value}
      </button>
    </span>
  )
}
