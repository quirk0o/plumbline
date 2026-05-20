'use client'

import { Gender } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { Dialog } from '@/components/ui'
import { SimForm, type SimFormData } from './sim-form'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

interface CreateSimModalProps {
  legacyId: string
  onCreated: (sim: SimMini) => void
  onClose: () => void
}

export function CreateSimModal({ legacyId, onCreated, onClose }: CreateSimModalProps) {
  const traitsQuery = trpc.traits.getAll.useQuery()
  const aspirationsQuery = trpc.aspirations.getAll.useQuery()
  const careersQuery = trpc.careers.getAll.useQuery()
  const createSim = trpc.sims.create.useMutation()

  const isLoading = traitsQuery.isLoading || aspirationsQuery.isLoading || careersQuery.isLoading

  async function handleSubmit(data: SimFormData) {
    const sim = await createSim.mutateAsync({ legacyId, ...data })
    onCreated({ id: sim.id, firstName: sim.firstName, lastName: sim.lastName, imageUrl: sim.imageUrl ?? null })
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content size="lg">
          <Dialog.Title>Create new sim</Dialog.Title>
          <Dialog.Description>They&apos;ll be linked automatically after you save.</Dialog.Description>
          {isLoading ? (
            <p>Loading…</p>
          ) : (
            <SimForm
              traits={traitsQuery.data ?? []}
              aspirations={aspirationsQuery.data ?? []}
              careers={careersQuery.data ?? []}
              defaultValues={{ gender: Gender.FEMALE }}
              submitLabel="Create sim"
              onBack={onClose}
              onSubmit={handleSubmit}
              isSubmitting={createSim.isPending}
            />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
