'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Gender, LifeStage, OccultType } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { ImageUpload } from '@/app/components/image-upload'
import styles from './page.module.css'

const GENDER_OPTIONS: Gender[] = [Gender.MALE, Gender.FEMALE, Gender.NON_BINARY]
const LIFE_STAGE_OPTIONS: LifeStage[] = [
  LifeStage.NEWBORN,
  LifeStage.INFANT,
  LifeStage.TODDLER,
  LifeStage.CHILD,
  LifeStage.TEEN,
  LifeStage.YOUNG_ADULT,
  LifeStage.ADULT,
  LifeStage.ELDER,
]
const OCCULT_OPTIONS: OccultType[] = [
  OccultType.VAMPIRE,
  OccultType.SPELLCASTER,
  OccultType.MERMAID,
  OccultType.WEREWOLF,
  OccultType.FAIRY,
  OccultType.ALIEN,
  OccultType.GHOST,
  OccultType.PLANT_SIM,
  OccultType.SERVO,
]

function formatEnum(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface SimProp {
  id: string
  firstName: string
  lastName: string
  gender: string
  lifeStage: string
  pronounSubject: string | null
  pronounObject: string | null
  pronounPossessive: string | null
  imageUrl: string | null
  occultType: string | null
}

export function IdentitySection({ sim }: { sim: SimProp }) {
  const update = trpc.sims.update.useMutation()

  function save(fields: Parameters<typeof update.mutate>[0]) {
    update.mutate(fields)
  }

  return (
    <div className={styles.hero}>
      <PortraitUpload sim={sim} onSave={(imageUrl) => save({ id: sim.id, imageUrl })} />

      <div className={styles.heroMeta}>
        <div className={styles.nameRow}>
          <InlineTextField
            value={sim.firstName}
            onSave={(v) => save({ id: sim.id, firstName: v })}
            ariaLabel="First name"
          />
          <InlineTextField
            value={sim.lastName}
            onSave={(v) => save({ id: sim.id, lastName: v })}
            ariaLabel="Last name"
          />
        </div>

        <div className={styles.metaRow}>
          <select
            className={styles.editableChip}
            defaultValue={sim.gender}
            aria-label="Gender"
            onChange={(e) => save({ id: sim.id, gender: e.target.value as Gender })}
          >
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>{formatEnum(g)}</option>
            ))}
          </select>

          <select
            className={styles.editableChip}
            defaultValue={sim.lifeStage}
            aria-label="Life stage"
            onChange={(e) => save({ id: sim.id, lifeStage: e.target.value as LifeStage })}
          >
            {LIFE_STAGE_OPTIONS.map((s) => (
              <option key={s} value={s}>{formatEnum(s)}</option>
            ))}
          </select>

          <select
            className={styles.editableChip}
            defaultValue={sim.occultType ?? ''}
            aria-label="Occult type"
            onChange={(e) =>
              save({ id: sim.id, occultType: (e.target.value as OccultType) || null })
            }
          >
            <option value="">None</option>
            {OCCULT_OPTIONS.map((o) => (
              <option key={o} value={o}>{formatEnum(o)}</option>
            ))}
          </select>
        </div>

        <PronounEditor sim={sim} onSave={save} />
      </div>
    </div>
  )
}

function PortraitUpload({
  sim,
  onSave,
}: {
  sim: SimProp
  onSave: (url: string) => void
}) {
  const [showUpload, setShowUpload] = useState(false)

  if (showUpload) {
    return (
      <div style={{ width: 88, flexShrink: 0 }}>
        <ImageUpload
          shape="circle"
          value={sim.imageUrl ?? undefined}
          onChange={(url) => {
            onSave(url)
            setShowUpload(false)
          }}
        />
      </div>
    )
  }

  return (
    <button
      style={{
        width: 88,
        height: 88,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        background: 'var(--green)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label="Change portrait"
      onClick={() => setShowUpload(true)}
    >
      {sim.imageUrl ? (
        <Image src={sim.imageUrl} alt={sim.firstName} fill sizes="88px" style={{ objectFit: 'cover' }} />
      ) : (
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'white' }}>
          {sim.firstName[0]}{sim.lastName[0]}
        </span>
      )}
    </button>
  )
}

function InlineTextField({
  value,
  onSave,
  ariaLabel,
}: {
  value: string
  onSave: (v: string) => void
  ariaLabel: string
}) {
  const [current, setCurrent] = useState(value)
  const [saved, setSaved] = useState(value)
  const [error, setError] = useState('')

  function handleBlur() {
    const trimmed = current.trim()
    if (!trimmed || trimmed === saved) { setCurrent(saved); return }
    try {
      onSave(trimmed)
      setSaved(trimmed)
      setError('')
    } catch {
      setCurrent(saved)
      setError('Failed to save')
    }
  }

  return (
    <span>
      <input
        className={styles.editableText}
        value={current}
        aria-label={ariaLabel}
        onChange={(e) => setCurrent(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setCurrent(saved); e.currentTarget.blur() }
        }}
        style={{ width: `${Math.max(current.length, 4)}ch` }}
      />
      {error && <span className={styles.inlineError}>{error}</span>}
    </span>
  )
}

function PronounEditor({
  sim,
  onSave,
}: {
  sim: SimProp
  onSave: (fields: { id: string; pronounSubject?: string | null; pronounObject?: string | null; pronounPossessive?: string | null }) => void
}) {
  const [open, setOpen] = useState(false)
  const display = sim.pronounSubject
    ? `${sim.pronounSubject} / ${sim.pronounObject} / ${sim.pronounPossessive}`
    : 'Add pronouns'

  if (!open) {
    return (
      <div className={styles.metaRow}>
        <button className={styles.editableChip} onClick={() => setOpen(true)}>
          {display}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.metaRow}>
      {(['pronounSubject', 'pronounObject', 'pronounPossessive'] as const).map((field, i) => (
        <input
          key={field}
          className={styles.editableChip}
          style={{ width: '7ch' }}
          defaultValue={(sim[field] as string | null) ?? ''}
          placeholder={(['she', 'her', 'her'] as const)[i]}
          aria-label={(['Subject pronoun', 'Object pronoun', 'Possessive pronoun'] as const)[i]}
          onBlur={(e) => onSave({ id: sim.id, [field]: e.target.value || null })}
        />
      ))}
      <button className={styles.removeBtn} onClick={() => setOpen(false)}>done</button>
    </div>
  )
}
