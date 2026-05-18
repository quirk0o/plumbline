'use client'
import { trpc } from '@/trpc/client'
import { FamilyTree } from '@/components/family-tree/FamilyTree'

type Props = { legacySlug: string }

export function LegacyTree({ legacySlug }: Props) {
  const { data, isLoading } = trpc.sims.getTreeData.useQuery({ legacySlug })

  if (isLoading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>Loading tree…</p>
  }
  if (!data || data.sims.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>No sims yet.</p>
  }

  return (
    <FamilyTree
      sims={data.sims}
      familyEdges={data.familyEdges}
      partnerEdges={data.partnerEdges}
      showMiniMap
      style={{ height: 500 }}
    />
  )
}
