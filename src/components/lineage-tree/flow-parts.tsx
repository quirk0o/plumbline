'use client'
import { Handle, Position, type EdgeProps } from '@xyflow/react'
import type { GenLabelNodeData, MarriageEdgeData, UnionNodeData } from './to-flow-graph'
import styles from './lineage-flow.module.css'

/** Amber generation pill in the left gutter. */
export function GenLabelNode({ data }: { data: GenLabelNodeData }) {
  return (
    <div className={styles.genPill} aria-hidden="true">
      {data.label}
    </div>
  )
}

/**
 * Invisible 1×1 anchor where children descend from. For an adjacent couple it
 * sits at the marriage-bond midpoint; for non-adjacent co-parents it hangs
 * below the row (fed by coParent elbows). When the junction joins two parents
 * to children it renders the amber diamond — the diamond ALWAYS means
 * "parents-to-children junction", never "marriage".
 *
 * Must be 1×1, not 0×0 — see to-flow-graph.ts union node comment for the two
 * xyflow falsy-zero pitfalls (nodesInitialized gate and handleBounds gate).
 */
export function UnionNode({ data }: { data: UnionNodeData }) {
  return (
    <div style={{ width: 1, height: 1, background: 'transparent', position: 'relative', overflow: 'visible' }}>
      {data.diamond && (
        <span
          data-testid="union-diamond"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: -3.5,
            top: -3.5,
            width: 8,
            height: 8,
            background: 'var(--amber)',
            transform: 'rotate(45deg)',
          }}
        />
      )}
      <Handle type="target" id="in" position={Position.Top} className={styles.handle} isConnectable={false} />
      <Handle type="source" id="out" position={Position.Bottom} className={styles.handle} isConnectable={false} />
    </div>
  )
}

/** Right-angle path: down from the bond, across, down to the child's top. */
export function descentPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  const midY = (sourceY + targetY) / 2
  return `M ${sourceX} ${sourceY} V ${midY} H ${targetX} V ${targetY}`
}

export function DescentEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  return (
    <path
      d={descentPath(sourceX, sourceY, targetX, targetY)}
      stroke="var(--border-bright)"
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  )
}

/**
 * Elbow from a parent's bottom handle down and across to a hanging union.
 * No trailing vertical: the union sits exactly at targetY, so the horizontal
 * run lands on it (contrast descentPath, which continues down to the child's
 * top handle).
 */
export function coParentPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  return `M ${sourceX} ${sourceY} V ${targetY} H ${targetX}`
}

export function CoParentEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  return (
    <path
      d={coParentPath(sourceX, sourceY, targetX, targetY)}
      stroke="var(--border-bright)"
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  )
}

/**
 * Amber bond between adjacent partners. Line only — the descent diamond is
 * rendered by the union node (and only exists when the couple has children).
 * Widowed bonds render dashed and faded.
 */
export function MarriageEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const dashed = (data as MarriageEdgeData | undefined)?.dashed === true
  return (
    <line
      x1={sourceX}
      y1={sourceY}
      x2={targetX}
      y2={targetY}
      stroke="var(--amber)"
      strokeWidth="1.5"
      strokeDasharray={dashed ? '4 3' : undefined}
      opacity={dashed ? 0.7 : undefined}
      aria-hidden="true"
    />
  )
}
