'use client'
import { useId } from 'react'
import type { LifeStage } from '@prisma/client'
import { formatLifeStage } from '@/lib/legacy-format'
import { CREST_ANCHORS } from './layout'

const { cx, cy } = CREST_ANCHORS
const RING_RADIUS = 22

/** The fields the Crest renderer needs from a tree sim. */
export type CrestNodeSim = {
  id: string
  firstName: string
  lastName: string
  imageUrl: string | null
  lifeStage: LifeStage
}

type CrestNodeProps = {
  sim: CrestNodeSim
  /** Top-left x of the node bbox. */
  x: number
  /** Top-left y of the node bbox. */
  y: number
  isHeir?: boolean
  isFounder?: boolean
  isSelected?: boolean
  /** Def id for the plumbob gradient (from the parent SVG's TreeDefs). */
  plumbobGradientId: string
  onSelect?: (id: string) => void
}

export function CrestNode({
  sim,
  x,
  y,
  isHeir = false,
  isFounder = false,
  isSelected = false,
  plumbobGradientId,
  onSelect,
}: CrestNodeProps) {
  // Unique per-node clip id so portraits never bleed across instances.
  const rawId = useId()
  const clipId = `crest-clip-${rawId.replace(/:/g, '')}`

  const initials =
    `${sim.firstName[0] ?? ''}${sim.lastName[0] ?? ''}`.toUpperCase() || '?'
  const fullName = `${sim.firstName} ${sim.lastName}`.trim()
  const lifeStageLabel = formatLifeStage(sim.lifeStage)

  // Amber ring marks heir / founder (legacy callouts); otherwise neutral text.
  const ringColor = isFounder || isHeir ? 'var(--amber)' : 'var(--text)'
  const innerRingColor = isFounder || isHeir ? 'var(--amber)' : 'var(--border-bright)'

  const handleActivate = () => onSelect?.(sim.id)

  return (
    <g
      transform={`translate(${x}, ${y})`}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={fullName}
      style={onSelect ? { cursor: 'pointer' } : undefined}
      onClick={onSelect ? handleActivate : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleActivate()
              }
            }
          : undefined
      }
    >
      {/* Selection halo */}
      {isSelected && (
        <circle
          cx={cx}
          cy={cy}
          r={RING_RADIUS + 6}
          fill="none"
          stroke="var(--green-glow)"
          strokeWidth="6"
        />
      )}

      {/* Outer ring medallion on a parchment surface */}
      <circle
        cx={cx}
        cy={cy}
        r={RING_RADIUS}
        fill="var(--bg)"
        stroke={ringColor}
        strokeWidth="1.5"
      />

      {sim.imageUrl ? (
        <>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={RING_RADIUS - 3} />
          </clipPath>
          {/* SVG <image> is not an HTML <img>; no next/image needed. */}
          <image
            href={sim.imageUrl}
            x={cx - RING_RADIUS + 3}
            y={cy - RING_RADIUS + 3}
            width={(RING_RADIUS - 3) * 2}
            height={(RING_RADIUS - 3) * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
            data-testid="crest-portrait"
            aria-hidden="true"
          />
          <circle
            cx={cx}
            cy={cy}
            r={RING_RADIUS - 3}
            fill="none"
            stroke={innerRingColor}
            strokeWidth="1"
            opacity="0.85"
          />
        </>
      ) : (
        <>
          <circle
            cx={cx}
            cy={cy}
            r={RING_RADIUS - 5}
            fill="none"
            stroke={innerRingColor}
            strokeWidth="0.75"
          />
          <text
            x={cx}
            y={cy + 5}
            textAnchor="middle"
            fill={isHeir ? 'var(--color-amber-700)' : 'var(--text)'}
            fontSize="16"
            fontStyle="italic"
            fontWeight="600"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
            data-testid="crest-monogram"
            aria-hidden="true"
          >
            {initials}
          </text>
        </>
      )}

      {/* Caption: amber divider + name + uppercase life-stage */}
      <line
        x1={cx - 18}
        y1={cy + RING_RADIUS + 8}
        x2={cx + 18}
        y2={cy + RING_RADIUS + 8}
        stroke="var(--amber)"
        strokeWidth="0.75"
        aria-hidden="true"
      />
      <text
        x={cx}
        y={cy + RING_RADIUS + 22}
        textAnchor="middle"
        fill="var(--text)"
        fontSize="13"
        fontWeight="600"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {fullName}
      </text>
      <text
        x={cx}
        y={cy + RING_RADIUS + 35}
        textAnchor="middle"
        fill="var(--text-subtle)"
        fontSize="8.5"
        style={{ letterSpacing: '0.22em', fontFamily: 'var(--font-body)' }}
      >
        {lifeStageLabel.toUpperCase()}
      </text>

      {/* Heir plumbob crown */}
      {isHeir && (
        <g
          transform={`translate(${cx - 6}, ${cy - RING_RADIUS - 12})`}
          data-testid="heir-crown"
          aria-hidden="true"
        >
          <rect
            x="0"
            y="0"
            width="12"
            height="12"
            rx="2.5"
            transform="rotate(45 6 6)"
            fill={`url(#${plumbobGradientId})`}
          />
        </g>
      )}
    </g>
  )
}
