'use client'
import { trpc } from '@/trpc/client'
import { FamilyTree } from '@/components/family-tree/FamilyTree'

type Props = { legacySlug: string }

export function LegacyTree({ legacySlug }: Props) {
  const { data, isLoading, isError } = trpc.sims.getTreeData.useQuery({ legacySlug })

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
      ariaLabel="Legacy family tree"
    />
  )
}
