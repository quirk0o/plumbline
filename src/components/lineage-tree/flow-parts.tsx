'use client'
import { Handle, Position, type EdgeProps } from '@xyflow/react'
import type { GenLabelNodeData } from './to-flow-graph'
import styles from './lineage-flow.module.css'

/** Amber generation pill in the left gutter (old SVG gutter labels). */
export function GenLabelNode({ data }: { data: GenLabelNodeData }) {
  return (
    <div className={styles.genPill} aria-hidden="true">
      {data.label}
    </div>
  )
}

/**
 * Invisible 0×0 anchor at a couple's marriage-bond midpoint. Descent edges
 * start here — the bond is where children descend from. For a lone parent it
 * sits at the medallion center, occluded until the line exits below (edges
 * render beneath nodes), matching the old connector behavior.
 */
export function UnionNode() {
  return (
    <div style={{ width: 0, height: 0 }}>
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

/** Amber bond between adjacent partners with a rotated diamond at the midpoint. */
export function MarriageEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const mx = (sourceX + targetX) / 2
  const my = (sourceY + targetY) / 2
  return (
    <g aria-hidden="true">
      <line x1={sourceX} y1={sourceY} x2={targetX} y2={targetY} stroke="var(--amber)" strokeWidth="1.5" />
      <rect x={mx - 4} y={my - 4} width="8" height="8" transform={`rotate(45 ${mx} ${my})`} fill="var(--amber)" />
    </g>
  )
}
