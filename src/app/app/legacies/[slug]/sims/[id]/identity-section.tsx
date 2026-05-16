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
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
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
    return update.mutateAsync(fields)
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
            <option value="">Human</option>
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
      <div style={{ width: 96, flexShrink: 0 }}>
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
      className={styles.portraitBtn}
      style={{
        width: 96,
        height: 96,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
        background: 'var(--border)',
        border: '2px solid var(--border)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.18s',
      }}
      aria-label="Change portrait"
      onClick={() => setShowUpload(true)}
    >
      {sim.imageUrl ? (
        <Image src={sim.imageUrl} alt={sim.firstName} fill sizes="96px" style={{ objectFit: 'cover' }} />
      ) : (
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--text-muted)' }}>
          {sim.firstName[0]}{sim.lastName[0]}
        </span>
      )}
      <span className={styles.portraitHint}>Upload</span>
    </button>
  )
}

function InlineTextField({
  value,
  onSave,
  ariaLabel,
}: {
  value: string
  onSave: (v: string) => Promise<unknown>
  ariaLabel: string
}) {
  const [current, setCurrent] = useState(value)
  const [saved, setSaved] = useState(value)
  const [error, setError] = useState('')

  async function handleBlur() {
    const trimmed = current.trim()
    if (!trimmed || trimmed === saved) { setCurrent(saved); return }
    try {
      await onSave(trimmed)
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

function defaultPronounsForGender(gender: string): { subject: string; object: string; possessive: string } {
  if (gender === 'FEMALE') return { subject: 'she', object: 'her', possessive: 'her' }
  if (gender === 'MALE') return { subject: 'he', object: 'him', possessive: 'his' }
  return { subject: 'they', object: 'them', possessive: 'their' }
}

function PronounEditor({
  sim,
  onSave,
}: {
  sim: SimProp
  onSave: (fields: { id: string; pronounSubject?: string | null; pronounObject?: string | null; pronounPossessive?: string | null }) => void
}) {
  const [editing, setEditing] = useState(false)
  const isExplicit = sim.pronounSubject !== null
  const derived = defaultPronounsForGender(sim.gender)
  const subject = isExplicit ? sim.pronounSubject! : derived.subject
  const object = isExplicit ? sim.pronounObject! : derived.object
  const possessive = isExplicit ? sim.pronounPossessive! : derived.possessive

  function handleSave(field: 'pronounSubject' | 'pronounObject' | 'pronounPossessive', value: string) {
    onSave({ id: sim.id, [field]: value.trim() || null })
  }

  if (!editing) {
    return (
      <button
        className={styles.pronounLine}
        data-derived={!isExplicit}
        onClick={() => setEditing(true)}
        aria-label="Edit pronouns"
        title={isExplicit ? 'Click to edit pronouns' : 'Derived from gender — click to set custom pronouns'}
      >
        {subject}/{object}
      </button>
    )
  }

  return (
    <div className={styles.pronounEdit}>
      <input
        className={styles.pronounInput}
        defaultValue={subject}
        aria-label="Subject pronoun"
        placeholder="she"
        onBlur={(e) => handleSave('pronounSubject', e.target.value)}
        autoFocus
      />
      <span className={styles.pronounSep}>/</span>
      <input
        className={styles.pronounInput}
        defaultValue={object}
        aria-label="Object pronoun"
        placeholder="her"
        onBlur={(e) => handleSave('pronounObject', e.target.value)}
      />
      <span className={styles.pronounSep}>/</span>
      <input
        className={styles.pronounInput}
        defaultValue={possessive}
        aria-label="Possessive pronoun"
        placeholder="her"
        onBlur={(e) => handleSave('pronounPossessive', e.target.value)}
      />
      <button
        className={styles.pronounDone}
        onClick={() => setEditing(false)}
      >
        done
      </button>
    </div>
  )
}
