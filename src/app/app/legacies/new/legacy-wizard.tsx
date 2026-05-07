'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FormField } from '@/components/ui/form-field/form-field'
import { Input } from '@/components/ui/input/input'
import { Button } from '@/components/ui/button/button'
import { ImageUpload } from '@/app/components/image-upload'
import { SimForm, type SimFormData } from '@/app/components/sim-form'
import { trpc } from '@/trpc/client'
import styles from './legacy-wizard.module.css'

interface LegacyData {
  name: string
  description: string
  imageUrl?: string
}

export function LegacyWizard() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [legacyData, setLegacyData] = useState<LegacyData>({ name: '', description: '' })
  const [nameError, setNameError] = useState('')

  const { data: traits = [] } = trpc.traits.getAll.useQuery()
  const { data: aspirations = [] } = trpc.aspirations.getAll.useQuery()
  const { data: careers = [] } = trpc.careers.getAll.useQuery()

  const createLegacy = trpc.legacies.create.useMutation()

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault()
    if (!legacyData.name.trim()) {
      setNameError('Legacy name is required')
      return
    }
    setNameError('')
    setStep(2)
  }

  async function submit(founder?: SimFormData) {
    try {
      const result = await createLegacy.mutateAsync({
        name: legacyData.name.trim(),
        description: legacyData.description.trim() || undefined,
        imageUrl: legacyData.imageUrl,
        founder: founder
          ? {
              ...founder,
              personalityTraitIds: founder.personalityTraitIds,
            }
          : undefined,
      })
      router.push(`/app/legacies/${result.legacy.slug}`)
    } catch {
      // error surfaced via createLegacy.error
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Step indicator */}
        <div className={styles.stepper}>
          <div className={`${styles.step} ${step === 1 ? styles.stepActive : styles.stepDone}`}>
            <div className={styles.stepDot}>{step > 1 ? '✓' : '1'}</div>
            <span className={styles.stepLabel}>Your Legacy</span>
          </div>
          <div className={styles.stepLine} />
          <div className={`${styles.step} ${step === 2 ? styles.stepActive : styles.stepPending}`}>
            <div className={styles.stepDot}>2</div>
            <span className={styles.stepLabel}>Founder Sim</span>
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className={styles.card}>
            <h1 className={styles.cardTitle}>Your Legacy</h1>
            <p className={styles.cardSubtitle}>Give your legacy a name and set the scene.</p>

            <form onSubmit={handleStep1Submit} noValidate>
              <div className={styles.legacyLayout}>
                <ImageUpload
                  value={legacyData.imageUrl}
                  onChange={(url) => setLegacyData((d) => ({ ...d, imageUrl: url }))}
                  shape="square"
                  label="Cover image"
                />
                <div className={styles.legacyFields}>
                  <FormField label="Legacy name" htmlFor="legacyName" required error={nameError}>
                    <Input
                      id="legacyName"
                      value={legacyData.name}
                      onChange={(e) => setLegacyData((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. The Caliente Legacy"
                      error={!!nameError}
                    />
                  </FormField>
                  <FormField label="Description" htmlFor="legacyDescription">
                    <textarea
                      id="legacyDescription"
                      value={legacyData.description}
                      onChange={(e) => setLegacyData((d) => ({ ...d, description: e.target.value }))}
                      placeholder="The story of your legacy…"
                      className={styles.textarea}
                      rows={3}
                    />
                  </FormField>
                </div>
              </div>

              <div className={styles.step1Actions}>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
                <Button type="submit">Continue →</Button>
              </div>
            </form>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className={styles.card}>
            <div className={styles.step2Header}>
              <div>
                <h1 className={styles.cardTitle}>Founder Sim</h1>
                <p className={styles.cardSubtitle}>Who starts the legacy? Only name and gender are required.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => submit()} disabled={createLegacy.isPending}>
                Skip →
              </Button>
            </div>

            {createLegacy.error && (
              <p className={styles.mutationError}>{createLegacy.error.message}</p>
            )}

            <SimForm
              traits={traits}
              aspirations={aspirations}
              careers={careers}
              onSubmit={submit}
              onBack={() => setStep(1)}
              onSkip={() => submit()}
              isSubmitting={createLegacy.isPending}
              submitLabel="Create legacy →"
              errors={createLegacy.error ? { root: createLegacy.error.message } : undefined}
            />
          </div>
        )}
      </div>
    </div>
  )
}
