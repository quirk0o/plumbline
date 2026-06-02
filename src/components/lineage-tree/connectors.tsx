/**
 * SVG connectors for the lineage tree. Both anchor to the Crest medallion edges
 * (via CREST_ANCHORS) so lines join the circle, never floating in empty space.
 */
import { CREST_ANCHORS, type PositionedNode } from './layout'

type MarriageBondProps = {
  a: PositionedNode
  b: PositionedNode
}

/**
 * A short amber line between two adjacent partners with a small rotated diamond
 * at the midpoint. Anchored at each medallion's vertical center.
 */
export function MarriageBond({ a, b }: MarriageBondProps) {
  // Render left-to-right regardless of input order.
  const [left, right] = a.x <= b.x ? [a, b] : [b, a]
  const y = left.y + CREST_ANCHORS.cy
  const x1 = left.x + CREST_ANCHORS.right
  const x2 = right.x + CREST_ANCHORS.left
  const mx = (x1 + x2) / 2
  return (
    <g aria-hidden="true">
      <line x1={x1} y1={y} x2={x2} y2={right.y + CREST_ANCHORS.cy} stroke="var(--amber)" strokeWidth="1.5" />
      <rect
        x={mx - 4}
        y={y - 4}
        width="8"
        height="8"
        transform={`rotate(45 ${mx} ${y})`}
        fill="var(--amber)"
      />
    </g>
  )
}

type ParentChildLineProps = {
  parents: PositionedNode[]
  child: PositionedNode
}

/**
 * A right-angle connector from the parents' marriage-bond line down to the top
 * of the child's medallion.
 */
export function ParentChildLine({ parents, child }: ParentChildLineProps) {
  if (parents.length === 0) return null

  // Source x: midpoint of parents' medallion centers.
  const sourceX =
    parents.reduce((sum, p) => sum + p.x + CREST_ANCHORS.cx, 0) / parents.length
  // Source y: the parents' marriage-bond line, which sits at the medallion
  // vertical center (cy) — the bond is where children descend from. For a lone
  // parent this starts at the medallion center and is occluded by the medallion
  // until it exits below (connectors render beneath nodes).
  const topParentY = Math.min(...parents.map((p) => p.y))
  const sourceY = topParentY + CREST_ANCHORS.cy

  const targetX = child.x + CREST_ANCHORS.cx
  const targetY = child.y + CREST_ANCHORS.top
  const midY = (sourceY + targetY) / 2

  return (
    <path
      d={`M ${sourceX} ${sourceY} V ${midY} H ${targetX} V ${targetY}`}
      stroke="var(--border-bright)"
      strokeWidth="1.5"
      fill="none"
      strokeLinejoin="round"
      aria-hidden="true"
    />
  )
}
