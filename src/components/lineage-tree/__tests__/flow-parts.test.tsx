// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider, type EdgeProps } from '@xyflow/react'
import { CoParentEdge, MarriageEdge, UnionNode, coParentPath } from '../flow-parts'

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
  it('drops from the parent, then runs across to the union', () => {
    expect(coParentPath(70, 70, 175, 118)).toBe('M 70 70 V 118 H 175')
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
  it('renders the elbow path', () => {
    const { container } = render(<svg><CoParentEdge {...edgeProps()} /></svg>)
    expect(container.querySelector('path')).toHaveAttribute('d', 'M 0 0 V 50 H 100')
  })
})
