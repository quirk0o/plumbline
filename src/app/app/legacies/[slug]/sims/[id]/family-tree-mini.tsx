'use client'
import { trpc } from '@/trpc/client'
import { FamilyTree } from '@/components/family-tree/FamilyTree'

type Props = { simId: string }

export function FamilyTreeMini({ simId }: Props) {
  const { data, isLoading, isError } = trpc.sims.getMiniTreeData.useQuery({ simId })

  if (isLoading) {
    return (
      <div role="status" aria-live="polite">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>Loading tree…</p>
      </div>
    )
  }
  if (isError) {
    return (
      <div role="alert" aria-live="assertive">
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>Could not load family tree.</p>
      </div>
    )
  }
  if (!data) return null

  const hasFamily = data.familyEdges.length > 0 || data.partnerEdges.length > 0
  if (!hasFamily) {
    return <p style={{ color: 'var(--text-muted)' }}>No recorded family yet.</p>
  }

  const focusedSim = data.sims.find((s) => s.id === simId)
  const ariaLabel = focusedSim
    ? `Family tree for ${focusedSim.firstName} ${focusedSim.lastName}`
    : 'Family tree'

  return (
    <FamilyTree
      sims={data.sims}
      familyEdges={data.familyEdges}
      partnerEdges={data.partnerEdges}
      focusSimId={simId}
      style={{ height: 280 }}
      ariaLabel={ariaLabel}
    />
  )
}
