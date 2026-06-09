'use client'
import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ReactFlowProvider } from '@xyflow/react'
import { trpc } from '@/trpc/client'
import { LineageFlow } from '@/components/lineage-tree/lineage-flow'

type Props = { simId: string }

export function FamilyTreeMini({ simId }: Props) {
  const router = useRouter()
  const { data, isLoading, isError } = trpc.sims.getMiniTreeData.useQuery({ simId })

  // Hooks must run unconditionally — declare them before the early returns,
  // deriving from `data?.sims ?? []` so toFlowGraph doesn't churn on a fresh
  // Map/handler every render.
  const hrefById = useMemo(
    () => new Map((data?.sims ?? []).map((s) => [s.id, s.href])),
    [data],
  )
  const handleSelect = useCallback(
    (id: string) => {
      const href = hrefById.get(id)
      if (href) router.push(href)
    },
    [hrefById, router],
  )

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

  return (
    <ReactFlowProvider>
      <div style={{ height: 280 }}>
        <LineageFlow
          sims={data.sims}
          familyEdges={data.familyEdges}
          // tRPC serialises endedAt as an ISO string; the layout type is
          // Date | null, so revive it at the client boundary.
          partnerEdges={data.partnerEdges.map((e) => ({
            ...e,
            endedAt: e.endedAt ? new Date(e.endedAt) : null,
          }))}
          focusSimId={simId}
          legacyName={focusedSim?.lastName}
          onSelectSim={handleSelect}
        />
      </div>
    </ReactFlowProvider>
  )
}
