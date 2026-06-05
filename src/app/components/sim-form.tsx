'use client'

import { useState, useEffect } from 'react'
import { Gender, LifeStage, OccultType } from '@prisma/client'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { FormField, Input, Button, Combobox } from '@/components/ui'
import { isLifeStageInRange } from '@/lib/life-stage'
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
  minLifeStage: LifeStage | null
  maxLifeStage: LifeStage | null
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
    getValues,
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

  const currentLifeStage = useWatch({ control, name: 'lifeStage' })

  const visibleTraits = traits.filter((t) =>
    isLifeStageInRange(currentLifeStage, t.minLifeStage, t.maxLifeStage)
  )

  const visibleAspirations = aspirations.filter((a) =>
    isLifeStageInRange(currentLifeStage, a.minLifeStage, a.maxLifeStage)
  )

  useEffect(() => {
    const traitIds = getValues('personalityTraitIds')
    const validTraitIds = traitIds.filter((id) => {
      const t = traits.find((t) => t.id === id)
      return !t || isLifeStageInRange(currentLifeStage, t.minLifeStage, t.maxLifeStage)
    })
    if (validTraitIds.length !== traitIds.length) setValue('personalityTraitIds', validTraitIds)

    const aspirationId = getValues('aspirationId')
    if (aspirationId) {
      const a = aspirations.find((a) => a.id === aspirationId)
      if (a && !isLifeStageInRange(currentLifeStage, a.minLifeStage, a.maxLifeStage)) {
        setValue('aspirationId', '')
      }
    }
  }, [currentLifeStage, traits, aspirations, getValues, setValue])

  function handlePronounPreset(value: string) {
    setPronounPreset(value)
    const preset = PRONOUN_PRESETS.find((p) => p.label === value)
    if (preset && value !== 'Custom') {
      setValue('pronounSubject', preset.subject)
      setValue('pronounObject', preset.object)
      setValue('pronounPossessive', preset.possessive)
    }
  }

  const groupedAspirations = groupBy(visibleAspirations, (a) => a.category)
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

            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <FormField label="Gender" htmlFor="gender" required error={formErrors.gender?.message}>
                  <Combobox
                    id="gender"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Select gender"
                    error={!!formErrors.gender}
                  >
                    <Combobox.Item value={Gender.FEMALE}>Female</Combobox.Item>
                    <Combobox.Item value={Gender.MALE}>Male</Combobox.Item>
                    <Combobox.Item value={Gender.NON_BINARY}>Non-Binary</Combobox.Item>
                  </Combobox>
                </FormField>
              )}
            />

            <Controller
              control={control}
              name="lifeStage"
              render={({ field }) => (
                <FormField label="Life stage" htmlFor="lifeStage">
                  <Combobox
                    id="lifeStage"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Select…"
                  >
                    {LIFE_STAGES.map((s) => (
                      <Combobox.Item key={s.value} value={s.value}>{s.label}</Combobox.Item>
                    ))}
                  </Combobox>
                </FormField>
              )}
            />

            <div className={styles.pronounRow}>
              <FormField label="Pronouns" htmlFor="pronounPreset">
                <Combobox
                  id="pronounPreset"
                  value={pronounPreset}
                  onChange={handlePronounPreset}
                  placeholder="— optional —"
                >
                  <Combobox.Item value="">— optional —</Combobox.Item>
                  {PRONOUN_PRESETS.map((p) => (
                    <Combobox.Item key={p.label} value={p.label}>{p.label}</Combobox.Item>
                  ))}
                </Combobox>
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
                <Controller
                  control={control}
                  name="occultType"
                  render={({ field }) => (
                    <FormField label="Occult type" htmlFor="occultType">
                      <Combobox
                        id="occultType"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder="None"
                      >
                        <Combobox.Item value="">None</Combobox.Item>
                        {OCCULT_TYPES.map((o) => (
                          <Combobox.Item key={o.value} value={o.value}>{o.label}</Combobox.Item>
                        ))}
                      </Combobox>
                    </FormField>
                  )}
                />
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
          <Controller
            control={control}
            name="aspirationId"
            render={({ field }) => (
              <FormField label="Aspiration" htmlFor="aspiration">
                <Combobox
                  id="aspiration"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="None"
                >
                  <Combobox.Item value="">None</Combobox.Item>
                  {Object.entries(groupedAspirations).map(([category, items]) => (
                    <Combobox.Section key={category} heading={category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}>
                      {items.map((a) => <Combobox.Item key={a.id} value={a.id}>{a.name}</Combobox.Item>)}
                    </Combobox.Section>
                  ))}
                </Combobox>
              </FormField>
            )}
          />

          <Controller
            control={control}
            name="careerId"
            render={({ field }) => (
              <FormField label="Career" htmlFor="career">
                <Combobox
                  id="career"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder="Unemployed"
                >
                  <Combobox.Item value="">Unemployed</Combobox.Item>
                  {Object.entries(groupedCareers).map(([type, items]) => (
                    <Combobox.Section key={type} heading={CAREER_TYPE_LABELS[type] ?? type}>
                      {items.map((c) => <Combobox.Item key={c.id} value={c.id}>{c.name}</Combobox.Item>)}
                    </Combobox.Section>
                  ))}
                </Combobox>
              </FormField>
            )}
          />
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
            <TraitPicker
              traits={visibleTraits}
              selected={field.value}
              onChange={field.onChange}
              max={6}
              lifeStage={currentLifeStage}
            />
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
