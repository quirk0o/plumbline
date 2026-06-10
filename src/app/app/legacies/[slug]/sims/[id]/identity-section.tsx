'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Gender, LifeStage, OccultType } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { ImageUpload } from '@/app/components/image-upload'
import { Combobox } from '@/components/ui'
import { roman } from '@/lib/legacy-format'
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
  isHeir: boolean
  generationNumber: number
}

export function IdentitySection({ sim, hasParents, onLifeStageChange }: { sim: SimProp; hasParents: boolean; onLifeStageChange?: (ls: LifeStage) => void }) {
  const update = trpc.sims.update.useMutation()

  function save(fields: Parameters<typeof update.mutate>[0]) {
    return update.mutateAsync(fields)
  }

  const [gender, setGender] = useState<Gender>(sim.gender as Gender)
  const [lifeStage, setLifeStage] = useState<LifeStage>(sim.lifeStage as LifeStage)
  const [occultType, setOccultType] = useState<OccultType | ''>((sim.occultType ?? '') as OccultType | '')

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

        <PronounEditor sim={sim} onSave={save} />

        <div className={styles.metaRow}>
          <Combobox
            value={gender}
            onChange={(v) => {
              setGender(v as Gender)
              save({ id: sim.id, gender: v as Gender })
            }}
            variant="chip"
            aria-label="Gender"
          >
            {GENDER_OPTIONS.map((g) => (
              <Combobox.Item key={g} value={g}>{formatEnum(g)}</Combobox.Item>
            ))}
          </Combobox>

          <Combobox
            value={lifeStage}
            onChange={(v) => {
              const ls = v as LifeStage
              setLifeStage(ls)
              onLifeStageChange?.(ls)
              save({ id: sim.id, lifeStage: ls })
            }}
            variant="chip"
            aria-label="Life stage"
          >
            {LIFE_STAGE_OPTIONS.map((s) => (
              <Combobox.Item key={s} value={s}>{formatEnum(s)}</Combobox.Item>
            ))}
          </Combobox>

          <Combobox
            value={occultType}
            onChange={(v) => {
              setOccultType(v as OccultType | '')
              save({ id: sim.id, occultType: (v as OccultType) || null })
            }}
            variant="chip"
            aria-label="Occult type"
            placeholder="Human"
          >
            <Combobox.Item value="">Human</Combobox.Item>
            {OCCULT_OPTIONS.map((o) => (
              <Combobox.Item key={o} value={o}>{formatEnum(o)}</Combobox.Item>
            ))}
          </Combobox>

          <HeirToggle sim={sim} onSave={save} />
          <GenerationField sim={sim} hasParents={hasParents} onSave={save} />
        </div>

      </div>
    </div>
  )
}

/**
 * Heir designation toggle. Marking a sim as heir is the only way to draw the
 * succession line; the server clears the previous heir in the same generation,
 * so this is a single-press action with optimistic local state.
 */
function HeirToggle({
  sim,
  onSave,
}: {
  sim: SimProp
  onSave: (fields: { id: string; isHeir: boolean }) => Promise<unknown>
}) {
  const [isHeir, setIsHeir] = useState(sim.isHeir)
  const [error, setError] = useState('')

  async function toggle() {
    const next = !isHeir
    setIsHeir(next)
    try {
      await onSave({ id: sim.id, isHeir: next })
      setError('')
    } catch {
      setIsHeir(!next)
      setError('Failed to save')
    }
  }

  return (
    <span className={styles.heirField}>
      <button
        type="button"
        className={styles.heirToggle}
        aria-pressed={isHeir}
        onClick={toggle}
      >
        Heir
      </button>
      {error && <span className={styles.inlineError}>{error}</span>}
    </span>
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
      />
      {error && <span className={styles.inlineError}>{error}</span>}
    </span>
  )
}

/**
 * Generation: read-only for derived sims (has parents — the value is
 * max(parent)+1 and maintained by the server), an editable chip select for
 * root sims (founders, partners, separate subtree roots).
 */
function GenerationField({
  sim,
  hasParents,
  onSave,
}: {
  sim: SimProp
  hasParents: boolean
  onSave: (fields: { id: string; generationNumber: number }) => Promise<unknown>
}) {
  const [value, setValue] = useState(sim.generationNumber)
  const [error, setError] = useState('')

  if (hasParents) {
    return <span className={styles.metaChipReadOnly}>Gen {roman(sim.generationNumber)}</span>
  }

  const ceiling = Math.max(10, value)
  const options = Array.from({ length: ceiling }, (_, i) => i + 1)

  async function change(next: string) {
    const n = Number(next)
    const prev = value
    setValue(n)
    try {
      await onSave({ id: sim.id, generationNumber: n })
      setError('')
    } catch {
      setValue(prev)
      setError('Failed to save')
    }
  }

  return (
    <span className={styles.generationField}>
      <Combobox value={String(value)} onChange={change} variant="chip" aria-label="Generation">
        {options.map((g) => (
          <Combobox.Item key={g} value={String(g)}>Gen {roman(g)}</Combobox.Item>
        ))}
      </Combobox>
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
  const subject = sim.pronounSubject ?? derived.subject
  const object = sim.pronounObject ?? derived.object
  const possessive = sim.pronounPossessive ?? derived.possessive

  const [draft, setDraft] = useState({ subject, object, possessive })

  function openEditor() {
    setDraft({ subject, object, possessive })
    setEditing(true)
  }

  function handleDone() {
    const s = draft.subject.trim() || null
    const o = draft.object.trim() || null
    const p = draft.possessive.trim() || null
    if (s !== sim.pronounSubject || o !== sim.pronounObject || p !== sim.pronounPossessive) {
      onSave({ id: sim.id, pronounSubject: s, pronounObject: o, pronounPossessive: p })
    }
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        className={styles.pronounLine}
        data-derived={!isExplicit}
        onClick={openEditor}
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
        value={draft.subject}
        aria-label="Subject pronoun"
        placeholder="she"
        onChange={(e) => setDraft(d => ({ ...d, subject: e.target.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') handleDone() }}
        autoFocus
      />
      <span className={styles.pronounSep}>/</span>
      <input
        className={styles.pronounInput}
        value={draft.object}
        aria-label="Object pronoun"
        placeholder="her"
        onChange={(e) => setDraft(d => ({ ...d, object: e.target.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') handleDone() }}
      />
      <span className={styles.pronounSep}>/</span>
      <input
        className={styles.pronounInput}
        value={draft.possessive}
        aria-label="Possessive pronoun"
        placeholder="her"
        onChange={(e) => setDraft(d => ({ ...d, possessive: e.target.value }))}
        onKeyDown={(e) => { if (e.key === 'Enter') handleDone() }}
      />
      <button
        className={styles.pronounDone}
        onClick={handleDone}
      >
        done
      </button>
    </div>
  )
}
