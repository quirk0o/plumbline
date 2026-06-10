'use client'
import { Handle, Position, type EdgeProps } from '@xyflow/react'
import type {
  BondEdgeData,
  DescentEdgeData,
  GenLabelNodeData,
  MarriageEdgeData,
  UnionNodeData,
} from './to-flow-graph'
import { CONNECTOR_DROP } from './layout-shared'
import styles from './lineage-flow.module.css'

/**
 * Shared amber-bond stroke style — both the in-row marriage line and the routed
 * cross-gen bond use it, so the widowed/current look stays identical across the
 * two. Amber (var(--amber)) is the lineage-callout color per the brand guide.
 */
const AMBER_STROKE_WIDTH = '1.5'
const AMBER_DASH_ARRAY = '4 3'
const AMBER_DASHED_OPACITY = 0.7

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
    <div className={styles.unionAnchor}>
      {data.diamond && <span data-testid="union-diamond" aria-hidden="true" className={styles.unionDiamond} />}
      <Handle type="target" id="in" position={Position.Top} className={styles.handle} isConnectable={false} />
      <Handle type="source" id="out" position={Position.Bottom} className={styles.handle} isConnectable={false} />
    </div>
  )
}

/** [low] Corner radius for the rounded connector elbows. */
const CORNER_RADIUS = 12

/**
 * [low] An SVG path through `points` with rounded corners: each interior vertex
 * becomes a quadratic arc of up to CORNER_RADIUS, clamped to half the shorter
 * adjacent segment so short runs stay clean. Consecutive duplicate points are
 * collapsed (e.g. a zero-width horizontal when source and target share a column).
 */
function roundedCorners(points: { x: number; y: number }[], radius = CORNER_RADIUS): string {
  const pts = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y)
  if (pts.length === 0) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const next = pts[i + 1]
    const inDx = curr.x - prev.x
    const inDy = curr.y - prev.y
    const outDx = next.x - curr.x
    const outDy = next.y - curr.y
    // Colinear (no real turn) → straight through, no arc.
    if (Math.abs(inDx * outDy - inDy * outDx) < 1e-6) {
      d += ` L ${curr.x} ${curr.y}`
      continue
    }
    const inLen = Math.hypot(inDx, inDy)
    const outLen = Math.hypot(outDx, outDy)
    const r = Math.min(radius, inLen / 2, outLen / 2)
    const inX = curr.x - (inDx / inLen) * r
    const inY = curr.y - (inDy / inLen) * r
    const outX = curr.x + (outDx / outLen) * r
    const outY = curr.y + (outDy / outLen) * r
    d += ` L ${inX} ${inY} Q ${curr.x} ${curr.y} ${outX} ${outY}`
  }
  const last = pts[pts.length - 1]
  if (pts.length > 1) d += ` L ${last.x} ${last.y}`
  return d
}

/** Rounded elbow: down from the bond, across, down to the child's top. */
export function descentPath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  const midY = (sourceY + targetY) / 2
  return roundedCorners([
    { x: sourceX, y: sourceY },
    { x: sourceX, y: midY },
    { x: targetX, y: midY },
    { x: targetX, y: targetY },
  ])
}

/**
 * [low] Descent path that skips a horizontal band (the source crest's text
 * band) so the line never paints across the sim's own name/stage. Two
 * sub-paths: a straight stub from the source down to the band top, then a
 * rounded elbow from the band bottom down-across-down to the target. No band →
 * identical to descentPath.
 */
export function descentPathWithGap(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  gapTop?: number,
  gapBottom?: number,
): string {
  if (gapTop === undefined || gapBottom === undefined) {
    return descentPath(sourceX, sourceY, targetX, targetY)
  }
  // Jog a fixed gap below the text band (not the midpoint), so the connector
  // hugs the crests and the long vertical drop fills the space above the next
  // generation. Clamp so the jog never passes the target.
  const midY = Math.min(gapBottom + CONNECTOR_DROP, (gapBottom + targetY) / 2)
  const stub = `M ${sourceX} ${sourceY} L ${sourceX} ${gapTop}`
  const below = roundedCorners([
    { x: sourceX, y: gapBottom },
    { x: sourceX, y: midY },
    { x: targetX, y: midY },
    { x: targetX, y: targetY },
  ])
  return `${stub} ${below}`
}

export function DescentEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const { gapTop, gapBottom } = (data as DescentEdgeData | undefined) ?? {}
  return (
    <path
      d={descentPathWithGap(sourceX, sourceY, targetX, targetY, gapTop, gapBottom)}
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
export function coParentPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  gapTop?: number,
  gapBottom?: number,
): string {
  // No band → plain elbow. With a band, skip the source crest's name/stage
  // text: the elbow starts at the medallion bottom (above the band) and would
  // otherwise paint straight down across it.
  if (gapTop === undefined || gapBottom === undefined) {
    return roundedCorners([
      { x: sourceX, y: sourceY },
      { x: sourceX, y: targetY },
      { x: targetX, y: targetY },
    ])
  }
  const stub = `M ${sourceX} ${sourceY} L ${sourceX} ${gapTop}`
  const below = roundedCorners([
    { x: sourceX, y: gapBottom },
    { x: sourceX, y: targetY },
    { x: targetX, y: targetY },
  ])
  return `${stub} ${below}`
}

export function CoParentEdge({ sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const { gapTop, gapBottom } = (data as DescentEdgeData | undefined) ?? {}
  return (
    <path
      d={coParentPath(sourceX, sourceY, targetX, targetY, gapTop, gapBottom)}
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
      strokeWidth={AMBER_STROKE_WIDTH}
      strokeDasharray={dashed ? AMBER_DASH_ARRAY : undefined}
      opacity={dashed ? AMBER_DASHED_OPACITY : undefined}
      aria-hidden="true"
    />
  )
}

/** Rounded polyline through canvas-space waypoints (the routed bond lane). */
export function bondPath(points: { x: number; y: number }[]): string {
  return roundedCorners(points)
}

/**
 * Amber routed bond for a cross-generation current couple. Unlike MarriageEdge
 * (a straight in-row line), this follows the engine-routed lane in `data.points`
 * so it clears intervening crests. Widowed bonds render dashed and faded.
 */
export function BondEdge({ data }: EdgeProps) {
  const { points = [], dashed = false } = (data as BondEdgeData | undefined) ?? {}
  return (
    <path
      d={bondPath(points)}
      stroke="var(--amber)"
      strokeWidth={AMBER_STROKE_WIDTH}
      fill="none"
      strokeLinejoin="round"
      strokeDasharray={dashed ? AMBER_DASH_ARRAY : undefined}
      opacity={dashed ? AMBER_DASHED_OPACITY : undefined}
      aria-hidden="true"
    />
  )
}
