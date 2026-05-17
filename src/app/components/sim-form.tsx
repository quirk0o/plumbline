'use client'

import { useState, useEffect } from 'react'
import { Gender, LifeStage, OccultType } from '@prisma/client'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Controller } from 'react-hook-form'
import { FormField, Input, Button, Select } from '@/components/ui'
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

const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  NEWBORN: 'Newborn',
  INFANT: 'Infant',
  TODDLER: 'Toddler',
  CHILD: 'Child',
  TEEN: 'Teen',
  YOUNG_ADULT: 'Young Adult',
  ADULT: 'Adult',
  ELDER: 'Elder',
}

const LIFE_STAGES = Object.values(LifeStage).map((v) => ({
  value: v,
  label: LIFE_STAGE_LABELS[v],
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

const emptyToUndefined = z.string().transform((v) => v || undefined)

const simFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  gender: z.string().refine(
    (v): v is Gender => (Object.values(Gender) as string[]).includes(v),
    'Gender is required'
  ).transform((v) => v as Gender),
  lifeStage: z.nativeEnum(LifeStage),
  pronounSubject: emptyToUndefined.optional(),
  pronounObject: emptyToUndefined.optional(),
  pronounPossessive: emptyToUndefined.optional(),
  imageUrl: z.string().optional(),
  personalityTraitIds: z.array(z.string()),
  aspirationId: emptyToUndefined.optional(),
  careerId: emptyToUndefined.optional(),
  occultType: z.string().transform((v) => (v || undefined) as OccultType | undefined),
})

export function SimForm({
  traits,
  aspirations,
  careers,
  defaultValues,
  onSubmit,
  onBack,
  isSubmitting,
  submitLabel = 'Save',
  errors,
}: SimFormProps) {
  const [pronounPreset, setPronounPreset] = useState(() => {
    if (!defaultValues?.pronounSubject) return ''
    const match = PRONOUN_PRESETS.find(
      (p) =>
        p.subject === defaultValues.pronounSubject &&
        p.object === defaultValues.pronounObject
    )
    return match ? match.label : 'Custom'
  })

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors: formErrors },
  } = useForm({
    resolver: zodResolver(simFormSchema),
    defaultValues: {
      firstName: defaultValues?.firstName ?? '',
      lastName: defaultValues?.lastName ?? '',
      gender: defaultValues?.gender ?? '',
      lifeStage: defaultValues?.lifeStage ?? LifeStage.YOUNG_ADULT,
      pronounSubject: defaultValues?.pronounSubject ?? '',
      pronounObject: defaultValues?.pronounObject ?? '',
      pronounPossessive: defaultValues?.pronounPossessive ?? '',
      imageUrl: defaultValues?.imageUrl,
      personalityTraitIds: defaultValues?.personalityTraitIds ?? [],
      aspirationId: defaultValues?.aspirationId ?? '',
      careerId: defaultValues?.careerId ?? '',
      occultType: defaultValues?.occultType ?? '',
    },
  })

  useEffect(() => {
    if (!errors) return
    for (const [field, msg] of Object.entries(errors)) {
      if (msg) setError(field as keyof SimFormData | 'root', { message: msg })
    }
  }, [errors, setError])

  function handlePronounPreset(value: string) {
    setPronounPreset(value)
    const preset = PRONOUN_PRESETS.find((p) => p.label === value)
    if (preset && value !== 'Custom') {
      setValue('pronounSubject', preset.subject)
      setValue('pronounObject', preset.object)
      setValue('pronounPossessive', preset.possessive)
    }
  }

  const groupedAspirations = groupBy(aspirations, (a) => a.category)
  const groupedCareers = groupBy(careers, (c) => c.type)

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} noValidate className={styles.form}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Identity</span>
          <div className={styles.sectionLine} />
        </div>

        <div className={styles.identityRow}>
          <Controller
            name="imageUrl"
            control={control}
            render={({ field }) => (
              <ImageUpload value={field.value} onChange={field.onChange} shape="circle" label="Photo" />
            )}
          />

          <div className={styles.identityGrid}>
            <FormField label="First name" htmlFor="firstName" required error={formErrors.firstName?.message}>
              <Input
                id="firstName"
                {...register('firstName')}
                placeholder="First name"
                error={!!formErrors.firstName}
              />
            </FormField>

            <FormField label="Last name" htmlFor="lastName" required error={formErrors.lastName?.message}>
              <Input
                id="lastName"
                {...register('lastName')}
                placeholder="Last name"
                error={!!formErrors.lastName}
              />
            </FormField>

            <FormField label="Gender" htmlFor="gender" required error={formErrors.gender?.message}>
              <Select
                id="gender"
                {...register('gender')}
                error={!!formErrors.gender}
              >
                <option value="">Select gender</option>
                <option value={Gender.FEMALE}>Female</option>
                <option value={Gender.MALE}>Male</option>
                <option value={Gender.NON_BINARY}>Non-Binary</option>
              </Select>
            </FormField>

            <FormField label="Life stage" htmlFor="lifeStage">
              <Select id="lifeStage" {...register('lifeStage')}>
                {LIFE_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </FormField>

            <div className={styles.pronounRow}>
              <FormField label="Pronouns" htmlFor="pronounPreset">
                <Select
                  id="pronounPreset"
                  value={pronounPreset}
                  onChange={(e) => handlePronounPreset(e.target.value)}
                >
                  <option value="">— optional —</option>
                  {PRONOUN_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>{p.label}</option>
                  ))}
                </Select>
              </FormField>
            </div>

            {pronounPreset === 'Custom' && (
              <div className={styles.customPronouns}>
                <FormField label="Subject (e.g. she)" htmlFor="pronounSubject">
                  <Input id="pronounSubject" {...register('pronounSubject')} placeholder="she" />
                </FormField>
                <FormField label="Object (e.g. her)" htmlFor="pronounObject">
                  <Input id="pronounObject" {...register('pronounObject')} placeholder="her" />
                </FormField>
                <FormField label="Possessive (e.g. hers)" htmlFor="pronounPossessive">
                  <Input id="pronounPossessive" {...register('pronounPossessive')} placeholder="hers" />
                </FormField>
              </div>
            )}

            <div className={styles.pronounRow}>
              <div className={styles.halfCol}>
                <FormField label="Occult type" htmlFor="occultType">
                  <Select id="occultType" {...register('occultType')}>
                    <option value="">None</option>
                    {OCCULT_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Goals &amp; Career</span>
          <div className={styles.sectionLine} />
        </div>
        <div className={styles.twoCol}>
          <FormField label="Aspiration" htmlFor="aspiration">
            <Select id="aspiration" {...register('aspirationId')}>
              <option value="">None</option>
              {Object.entries(groupedAspirations).map(([category, items]) => (
                <optgroup key={category} label={category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}>
                  {items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </FormField>

          <FormField label="Career" htmlFor="career">
            <Select id="career" {...register('careerId')}>
              <option value="">Unemployed</option>
              {Object.entries(groupedCareers).map(([type, items]) => (
                <optgroup key={type} label={CAREER_TYPE_LABELS[type] ?? type}>
                  {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </FormField>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Personality</span>
          <div className={styles.sectionLine} />
          <span className={styles.sectionHint}>up to 6 traits</span>
        </div>
        <Controller
          name="personalityTraitIds"
          control={control}
          render={({ field }) => (
            <TraitPicker traits={traits} selected={field.value} onChange={field.onChange} max={6} />
          )}
        />
      </div>

      {formErrors.root?.message && <p className={styles.rootError}>{formErrors.root.message}</p>}

      <div className={styles.actions}>
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            <span aria-hidden="true">← </span>Back
          </Button>
        )}
        <div className={styles.rightActions}>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
