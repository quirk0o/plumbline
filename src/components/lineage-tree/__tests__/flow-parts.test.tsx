// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider, type EdgeProps } from '@xyflow/react'
import { BondEdge, CoParentEdge, MarriageEdge, UnionNode, coParentPath, descentPath, descentPathWithGap } from '../flow-parts'

const edgeProps = (over: Partial<EdgeProps> = {}): EdgeProps =>
  ({ id: 'e', source: 'a', target: 'b', sourceX: 0, sourceY: 0, targetX: 100, targetY: 50, ...over }) as EdgeProps

// UnionNode renders <Handle> components, which need a ReactFlow store —
// wrap it in ReactFlowProvider, matching crest-flow-node.test.tsx.
function renderUnion(data: { diamond: boolean }) {
  return render(
    <ReactFlowProvider>
      <UnionNode data={data} />
    </ReactFlowProvider>,
  )
}

describe('coParentPath', () => {
  it('drops from the parent and rounds across to the union', () => {
    const d = coParentPath(70, 70, 175, 118)
    expect(d.startsWith('M 70 70')).toBe(true) // leaves the parent
    expect(d.trimEnd().endsWith('175 118')).toBe(true) // lands on the union
    expect(d).toContain('Q') // the corner is rounded, not a hard right angle
  })
})

describe('MarriageEdge', () => {
  it('renders a solid line without a diamond by default', () => {
    const { container } = render(<svg><MarriageEdge {...edgeProps({ data: { dashed: false } })} /></svg>)
    expect(container.querySelector('line')).not.toHaveAttribute('stroke-dasharray')
    expect(container.querySelector('rect')).toBeNull()
  })
  it('renders dashed when data.dashed is true', () => {
    const { container } = render(<svg><MarriageEdge {...edgeProps({ data: { dashed: true } })} /></svg>)
    expect(container.querySelector('line')).toHaveAttribute('stroke-dasharray')
  })
})

describe('BondEdge', () => {
  const points = [{ x: 10, y: 20 }, { x: 10, y: 100 }, { x: 10, y: 180 }]
  it('renders the routed polyline through the waypoints, solid by default', () => {
    const { container } = render(
      <svg><BondEdge {...edgeProps({ data: { points, dashed: false } })} /></svg>,
    )
    const path = container.querySelector('path')
    expect(path).toHaveAttribute('d', 'M 10 20 L 10 100 L 10 180')
    expect(path).not.toHaveAttribute('stroke-dasharray')
  })
  it('renders dashed when widowed', () => {
    const { container } = render(
      <svg><BondEdge {...edgeProps({ data: { points, dashed: true } })} /></svg>,
    )
    expect(container.querySelector('path')).toHaveAttribute('stroke-dasharray')
  })
})

describe('UnionNode', () => {
  it('renders a diamond when data.diamond is true', () => {
    const { container } = renderUnion({ diamond: true })
    expect(container.querySelector('[data-testid="union-diamond"]')).not.toBeNull()
  })
  it('renders no diamond when data.diamond is false', () => {
    const { container } = renderUnion({ diamond: false })
    expect(container.querySelector('[data-testid="union-diamond"]')).toBeNull()
  })
})

describe('CoParentEdge', () => {
  it('renders a rounded elbow from source to target', () => {
    const { container } = render(<svg><CoParentEdge {...edgeProps()} /></svg>)
    const d = container.querySelector('path')?.getAttribute('d') ?? ''
    expect(d.startsWith('M 0 0')).toBe(true)
    expect(d.trimEnd().endsWith('100 50')).toBe(true)
    expect(d).toContain('Q')
  })
})

describe('descentPathWithGap', () => {
  it('starts the line below the text band (not at the source), reaching the target', () => {
    // gapBottom = 114 is the source crest's card bottom. The line begins there —
    // emerging from below the text — with nothing painted at/above the band.
    const d = descentPathWithGap(100, 24, 100, 300, 74, 114)
    expect(d.startsWith('M 100 114')).toBe(true) // begins below the text band
    expect(d.match(/M /g)).toHaveLength(1) // a single continuous line (no hidden gap)
    expect(d).not.toContain('24') // nothing drawn up at the medallion/source
    expect(d.trimEnd().endsWith('100 300')).toBe(true) // reaches the child
  })

  it('falls back to the plain descent path when no gap band is given', () => {
    expect(descentPathWithGap(100, 50, 240, 170)).toBe(descentPath(100, 50, 240, 170))
  })
})
