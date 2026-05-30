'use client'
import { useId, useMemo } from 'react'
import type { RouterOutputs } from '@/trpc/client'
import { roman } from '@/lib/legacy-format'
import { cn } from '@/lib/utils'
import { computeLineageLayout, NODE_HEIGHT } from './layout'
import { TreeDefs, treeDefIds } from './tree-defs'
import { CrestNode } from './crest-node'
import { MarriageBond, ParentChildLine } from './connectors'
import styles from './lineage-tree.module.css'

type TreeData = RouterOutputs['sims']['getTreeData']
export type LineageTreeSim = TreeData['sims'][number]
export type LineageFamilyEdge = TreeData['familyEdges'][number]
export type LineagePartnerEdge = TreeData['partnerEdges'][number]

export type LineageTreeProps = {
  sims: LineageTreeSim[]
  familyEdges: LineageFamilyEdge[]
  partnerEdges: LineagePartnerEdge[]
  founderSimId?: string
  selectedId?: string
  onSelectSim?: (id: string) => void
  /** Legacy name for the tree's accessible group label (defaults to "Family"). */
  legacyName?: string
  className?: string
}

export function LineageTree({
  sims,
  familyEdges,
  partnerEdges,
  founderSimId,
  selectedId,
  onSelectSim,
  legacyName,
  className,
}: LineageTreeProps) {
  const rawId = useId()
  const idPrefix = rawId.replace(/:/g, '')
  const defIds = treeDefIds(idPrefix)

  const layout = useMemo(
    () => computeLineageLayout(sims, familyEdges, partnerEdges),
    [sims, familyEdges, partnerEdges],
  )

  const simById = useMemo(() => {
    const map = new Map<string, LineageTreeSim>()
    for (const sim of sims) map.set(sim.id, sim)
    return map
  }, [sims])

  if (sims.length === 0) return null

  const { width, height } = layout.viewBox

  // Marriage bonds: only render when both partners are positioned in the same
  // row of the layout.
  const bonds = partnerEdges.flatMap(({ simAId, simBId }) => {
    const a = layout.byId[simAId]
    const b = layout.byId[simBId]
    if (!a || !b || a.y !== b.y) return []
    return [{ key: `${simAId}-${simBId}`, a, b }]
  })

  // Parent-child connectors: group family edges by child so a child gets a
  // single connector from its parents' midpoint.
  const parentsByChild = new Map<string, string[]>()
  for (const { parentId, childId } of familyEdges) {
    if (!layout.byId[parentId] || !layout.byId[childId]) continue
    const list = parentsByChild.get(childId) ?? []
    if (!list.includes(parentId)) list.push(parentId)
    parentsByChild.set(childId, list)
  }

  return (
    <svg
      className={cn(styles.tree, className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={`${legacyName ?? 'Family'} tree — ${sims.length} sims`}
    >
      <TreeDefs idPrefix={idPrefix} />

      {/* Generation row labels in the left gutter */}
      {layout.rowYs.map((rowY, rowIndex) => {
        const gen = layout.rowGenerations[rowIndex]
        const label = gen === null ? 'GEN —' : `GEN ${roman(gen)}`
        return (
          <g
            key={`gen-${gen ?? 'null'}`}
            transform={`translate(8, ${rowY + NODE_HEIGHT / 2 - 30})`}
            aria-hidden="true"
          >
            <rect
              x="-2"
              y="-12"
              width="54"
              height="24"
              rx="12"
              fill="none"
              stroke="var(--amber)"
              strokeWidth="1"
            />
            <text
              x="25"
              y="5"
              textAnchor="middle"
              fill="var(--color-amber-700)"
              fontSize="11"
              fontWeight="600"
              style={{ letterSpacing: '0.14em', fontFamily: 'var(--font-body)' }}
            >
              {label}
            </text>
          </g>
        )
      })}

      {/* Parent-child connectors first (sit beneath bonds + nodes) */}
      {Array.from(parentsByChild.entries()).map(([childId, parentIds]) => (
        <ParentChildLine
          key={`pc-${childId}`}
          parents={parentIds.map((id) => layout.byId[id])}
          child={layout.byId[childId]}
        />
      ))}

      {/* Marriage bonds */}
      {bonds.map((bond) => (
        <MarriageBond key={`m-${bond.key}`} a={bond.a} b={bond.b} />
      ))}

      {/* Nodes */}
      {layout.nodes.map((node) => {
        const sim = simById.get(node.id)
        if (!sim) return null
        return (
          <CrestNode
            key={node.id}
            sim={sim}
            x={node.x}
            y={node.y}
            isHeir={sim.isHeir}
            isFounder={founderSimId === sim.id}
            isSelected={selectedId === sim.id}
            plumbobGradientId={defIds.plumbobGradient}
            liftFilterId={defIds.liftShadow}
            onSelect={onSelectSim}
          />
        )
      })}
    </svg>
  )
}
