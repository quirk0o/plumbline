'use client'
import { useRouter } from 'next/navigation'
import { ReactFlowProvider } from '@xyflow/react'
import { trpc } from '@/trpc/client'
import { LineageFlow } from '@/components/lineage-tree/lineage-flow'

type Props = { simId: string }

export function FamilyTreeMini({ simId }: Props) {
  const router = useRouter()
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

  const hrefById = new Map(data.sims.map((s) => [s.id, s.href]))

  return (
    <ReactFlowProvider>
      <div style={{ height: 280 }}>
        <LineageFlow
          sims={data.sims}
          familyEdges={data.familyEdges}
          partnerEdges={data.partnerEdges}
          focusSimId={simId}
          onSelectSim={(id) => {
            const href = hrefById.get(id)
            if (href) router.push(href)
          }}
        />
      </div>
    </ReactFlowProvider>
  )
}
