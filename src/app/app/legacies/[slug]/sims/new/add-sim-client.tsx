'use client'

import { useRouter } from 'next/navigation'
import type { LifeStage } from '@prisma/client'
import { SimForm, type SimFormData } from '@/app/components/sim-form'
import { trpc } from '@/trpc/client'
import type { Trait } from '@/app/components/trait-picker'

interface AddSimClientProps {
  legacyId: string
  slug: string
  traits: Trait[]
  aspirations: { id: string; name: string; category: string; minLifeStage: LifeStage | null; maxLifeStage: LifeStage | null }[]
  careers: { id: string; name: string; type: string }[]
  households: { id: string; name: string }[]
}

export function AddSimClient({ legacyId, slug, traits, aspirations, careers, households }: AddSimClientProps) {
  const router = useRouter()
  const createSim = trpc.sims.create.useMutation()

  async function handleSubmit(data: SimFormData) {
    try {
      await createSim.mutateAsync({ legacyId, ...data })
      router.push(`/app/legacies/${slug}`)
    } catch {
      // error surfaced via createSim.error
    }
  }

  return (
    <SimForm
      traits={traits}
      aspirations={aspirations}
      careers={careers}
      households={households}
      onSubmit={handleSubmit}
      onBack={() => router.push(`/app/legacies/${slug}`)}
      isSubmitting={createSim.isPending}
      submitLabel="Add sim"
      errors={createSim.error ? { root: createSim.error.message } : undefined}
    />
  )
}
