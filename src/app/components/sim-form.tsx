'use client'

import { useState } from 'react'
import { Gender, LifeStage, OccultType } from '@prisma/client'
import { FormField } from '@/components/ui/form-field/form-field'
import { Input } from '@/components/ui/input/input'
import { Button } from '@/components/ui/button/button'
import { ImageUpload } from './image-upload'
import { TraitPicker, type Trait } from './trait-picker'
import styles from './sim-form.module.css'

export interface SimFormData {
  firstName: string
  lastName: string
  gender: Gender
  lifeStage: LifeStage
  pronounSubject?: string
  pronounObject?: string
  pronounPossessive?: string
  imageUrl?: string
  personalityTraitIds: string[]
  aspirationId?: string
  careerId?: string
  occultType?: OccultType
}

interface Aspiration {
  id: string
  name: string
  category: string
}

interface Career {
  id: string
  name: string
  type: string
}

interface SimFormProps {
  traits: Trait[]
  aspirations: Aspiration[]
  careers: Career[]
  defaultValues?: Partial<SimFormData>
  onSubmit: (data: SimFormData) => void
  onSkip?: () => void
  onBack?: () => void
  isSubmitting?: boolean
  submitLabel?: string
  errors?: Partial<Record<keyof SimFormData | 'root', string>>
}

const PRONOUN_PRESETS = [
  { label: 'She / Her / Hers',     subject: 'she',  object: 'her',  possessive: 'hers' },
  { label: 'He / Him / His',       subject: 'he',   object: 'him',  possessive: 'his' },
  { label: 'They / Them / Theirs', subject: 'they', object: 'them', possessive: 'theirs' },
  { label: 'Ze / Zir / Zirs',      subject: 'ze',   object: 'zir',  possessive: 'zirs' },
  { label: 'Custom',               subject: '',     object: '',     possessive: '' },
]

const LIFE_STAGES = Object.values(LifeStage).map((v) => ({
  value: v,
  label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}))

const OCCULT_TYPES = Object.values(OccultType).map((v) => ({
  value: v,
  label: v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
}))

const CAREER_TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  ACTIVE: 'Active',
  PART_TIME: 'Part-time',
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item)
    return { ...acc, [k]: [...(acc[k] ?? []), item] }
  }, {} as Record<string, T[]>)
}

export function SimForm({
  traits,
  aspirations,
  careers,
  defaultValues,
  onSubmit,
  onSkip,
  onBack,
  isSubmitting,
  submitLabel = 'Save',
  errors,
}: SimFormProps) {
  const [firstName, setFirstName] = useState(defaultValues?.firstName ?? '')
  const [lastName, setLastName] = useState(defaultValues?.lastName ?? '')
  const [gender, setGender] = useState<Gender | ''>(defaultValues?.gender ?? '')
  const [lifeStage, setLifeStage] = useState<LifeStage>(defaultValues?.lifeStage ?? LifeStage.YOUNG_ADULT)
  const [pronounPreset, setPronounPreset] = useState('')
  const [pronounSubject, setPronounSubject] = useState(defaultValues?.pronounSubject ?? '')
  const [pronounObject, setPronounObject] = useState(defaultValues?.pronounObject ?? '')
  const [pronounPossessive, setPronounPossessive] = useState(defaultValues?.pronounPossessive ?? '')
  const [imageUrl, setImageUrl] = useState(defaultValues?.imageUrl)
  const [selectedTraits, setSelectedTraits] = useState<string[]>(defaultValues?.personalityTraitIds ?? [])
  const [aspirationId, setAspirationId] = useState(defaultValues?.aspirationId ?? '')
  const [careerId, setCareerId] = useState(defaultValues?.careerId ?? '')
  const [occultType, setOccultType] = useState(defaultValues?.occultType ?? '')
  const [localErrors, setLocalErrors] = useState<Partial<Record<string, string>>>({})

  function handlePronounPreset(value: string) {
    setPronounPreset(value)
    const preset = PRONOUN_PRESETS.find((p) => p.label === value)
    if (preset && value !== 'Custom') {
      setPronounSubject(preset.subject)
      setPronounObject(preset.object)
      setPronounPossessive(preset.possessive)
    }
  }

  function validate(): boolean {
    const errs: Partial<Record<string, string>> = {}
    if (!firstName.trim()) errs.firstName = 'First name is required'
    if (!lastName.trim()) errs.lastName = 'Last name is required'
    if (!gender) errs.gender = 'Gender is required'
    setLocalErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender: gender as Gender,
      lifeStage,
      pronounSubject: pronounSubject || undefined,
      pronounObject: pronounObject || undefined,
      pronounPossessive: pronounPossessive || undefined,
      imageUrl,
      personalityTraitIds: selectedTraits,
      aspirationId: aspirationId || undefined,
      careerId: careerId || undefined,
      occultType: (occultType as OccultType) || undefined,
    })
  }

  const allErrors = { ...localErrors, ...errors }
  const groupedAspirations = groupBy(aspirations, (a) => a.category)
  const groupedCareers = groupBy(careers, (c) => c.type)

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      {/* ── Identity ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Identity</span>
          <div className={styles.sectionLine} />
        </div>

        <div className={styles.identityRow}>
          <ImageUpload value={imageUrl} onChange={setImageUrl} shape="circle" label="Photo" />

          <div className={styles.identityGrid}>
            <FormField label="First name" htmlFor="firstName" required error={allErrors.firstName}>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                error={!!allErrors.firstName}
              />
            </FormField>

            <FormField label="Last name" htmlFor="lastName" required error={allErrors.lastName}>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                error={!!allErrors.lastName}
              />
            </FormField>

            <FormField label="Gender" htmlFor="gender" required error={allErrors.gender}>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className={`${styles.select} ${allErrors.gender ? styles.selectError : ''}`}
              >
                <option value="">Select gender</option>
                <option value={Gender.FEMALE}>Female</option>
                <option value={Gender.MALE}>Male</option>
                <option value={Gender.NON_BINARY}>Non-Binary</option>
              </select>
            </FormField>

            <FormField label="Life stage" htmlFor="lifeStage">
              <select
                id="lifeStage"
                value={lifeStage}
                onChange={(e) => setLifeStage(e.target.value as LifeStage)}
                className={styles.select}
              >
                {LIFE_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </FormField>

            <div className={styles.pronounRow}>
              <FormField label="Pronouns" htmlFor="pronounPreset">
                <select
                  id="pronounPreset"
                  value={pronounPreset}
                  onChange={(e) => handlePronounPreset(e.target.value)}
                  className={styles.select}
                >
                  <option value="">— optional —</option>
                  {PRONOUN_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>{p.label}</option>
                  ))}
                </select>
              </FormField>
            </div>

            {pronounPreset === 'Custom' && (
              <div className={styles.customPronouns}>
                <FormField label="Subject (e.g. she)" htmlFor="pronounSubject">
                  <Input id="pronounSubject" value={pronounSubject} onChange={(e) => setPronounSubject(e.target.value)} placeholder="she" />
                </FormField>
                <FormField label="Object (e.g. her)" htmlFor="pronounObject">
                  <Input id="pronounObject" value={pronounObject} onChange={(e) => setPronounObject(e.target.value)} placeholder="her" />
                </FormField>
                <FormField label="Possessive (e.g. hers)" htmlFor="pronounPossessive">
                  <Input id="pronounPossessive" value={pronounPossessive} onChange={(e) => setPronounPossessive(e.target.value)} placeholder="hers" />
                </FormField>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Personality ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Personality</span>
          <div className={styles.sectionLine} />
          <span className={styles.sectionHint}>up to 6 traits</span>
        </div>
        <TraitPicker traits={traits} selected={selectedTraits} onChange={setSelectedTraits} max={6} />
      </div>

      {/* ── Goals & Career ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Goals &amp; Career</span>
          <div className={styles.sectionLine} />
        </div>
        <div className={styles.twoCol}>
          <FormField label="Aspiration" htmlFor="aspiration">
            <select id="aspiration" value={aspirationId} onChange={(e) => setAspirationId(e.target.value)} className={styles.select}>
              <option value="">None</option>
              {Object.entries(groupedAspirations).map(([category, items]) => (
                <optgroup key={category} label={category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}>
                  {items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              ))}
            </select>
          </FormField>

          <FormField label="Career" htmlFor="career">
            <select id="career" value={careerId} onChange={(e) => setCareerId(e.target.value)} className={styles.select}>
              <option value="">Unemployed</option>
              {Object.entries(groupedCareers).map(([type, items]) => (
                <optgroup key={type} label={CAREER_TYPE_LABELS[type] ?? type}>
                  {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </FormField>
        </div>
      </div>

      {/* ── Special ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Special</span>
          <div className={styles.sectionLine} />
        </div>
        <div className={styles.halfCol}>
          <FormField label="Occult type" htmlFor="occultType">
            <select id="occultType" value={occultType} onChange={(e) => setOccultType(e.target.value)} className={styles.select}>
              <option value="">None</option>
              {OCCULT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormField>
        </div>
      </div>

      {/* ── Actions ── */}
      {allErrors.root && <p className={styles.rootError}>{allErrors.root}</p>}

      <div className={styles.actions}>
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            ← Back
          </Button>
        )}
        <div className={styles.rightActions}>
          {onSkip && (
            <Button type="button" variant="outline" onClick={onSkip}>
              Skip this step
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
