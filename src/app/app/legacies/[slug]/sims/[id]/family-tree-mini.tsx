'use client'
import { trpc } from '@/trpc/client'
import { FamilyTree } from '@/components/family-tree/FamilyTree'

type Props = { simId: string }

export function FamilyTreeMini({ simId }: Props) {
  const { data, isLoading, isError } = trpc.sims.getMiniTreeData.useQuery({ simId })

  if (isLoading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>Loading tree…</p>
  }
  if (isError) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>Could not load family tree.</p>
  }
  if (!data || data.sims.length === 0) return null

  return (
    <FamilyTree
      sims={data.sims}
      familyEdges={data.familyEdges}
      partnerEdges={data.partnerEdges}
      focusSimId={simId}
      style={{ height: 280 }}
    />
  )
}
