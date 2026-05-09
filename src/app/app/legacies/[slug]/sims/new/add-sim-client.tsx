'use client'

import { useRouter } from 'next/navigation'
import { SimForm, type SimFormData } from '@/app/components/sim-form'
import { trpc } from '@/trpc/client'
import type { Trait } from '@/app/components/trait-picker'

interface AddSimClientProps {
  legacyId: string
  slug: string
  traits: Trait[]
  aspirations: { id: string; name: string; category: string }[]
  careers: { id: string; name: string; type: string }[]
}

export function AddSimClient({ legacyId, slug, traits, aspirations, careers }: AddSimClientProps) {
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
      onSubmit={handleSubmit}
      onBack={() => router.push(`/app/legacies/${slug}`)}
      isSubmitting={createSim.isPending}
      submitLabel="Add sim"
      errors={createSim.error ? { root: createSim.error.message } : undefined}
    />
  )
}
