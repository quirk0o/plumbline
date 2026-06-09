// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import { LineageFlow } from '../lineage-flow'
import type { LineageFlowSim } from '../to-flow-graph'

const sims: LineageFlowSim[] = [
  { id: 'founder', firstName: 'Bella', lastName: 'Goth', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false, isDeceased: false, gender: 'FEMALE' },
  { id: 'spouse', firstName: 'Mortimer', lastName: 'Goth', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false, isDeceased: false, gender: 'MALE' },
  { id: 'heir', firstName: 'Cassandra', lastName: 'Goth', imageUrl: null, generationNumber: 2, lifeStage: 'TEEN', isHeir: true, isDeceased: false, gender: 'FEMALE' },
]
const familyEdges = [
  { parentId: 'founder', childId: 'heir' },
  { parentId: 'spouse', childId: 'heir' },
]
const partnerEdges = [{ simAId: 'founder', simBId: 'spouse', romanticStatus: 'MARRIED' as const, endedAt: null }]

function renderTree(props: Partial<React.ComponentProps<typeof LineageFlow>> = {}) {
  return render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <LineageFlow
          sims={sims}
          familyEdges={familyEdges}
          partnerEdges={partnerEdges}
          legacyName="Goth"
          {...props}
        />
      </div>
    </ReactFlowProvider>,
  )
}

describe('LineageFlow', () => {
  it('labels the tree as a group using the legacy name', () => {
    renderTree()
    expect(screen.getByRole('group', { name: 'Goth tree — 3 sims' })).toBeInTheDocument()
  })

  it('falls back to "Family" in the group label', () => {
    renderTree({ legacyName: undefined })
    expect(screen.getByRole('group', { name: 'Family tree — 3 sims' })).toBeInTheDocument()
  })

  it('exposes each sim as a button named with name + life stage when selectable', () => {
    renderTree({ onSelectSim: vi.fn() })
    expect(screen.getByRole('button', { name: 'Bella Goth, Adult' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mortimer Goth, Adult' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cassandra Goth, Teen' })).toBeInTheDocument()
  })

  it('calls onSelectSim with the sim id when a node is clicked', async () => {
    const onSelectSim = vi.fn()
    const user = userEvent.setup()
    renderTree({ onSelectSim })
    await user.click(screen.getByRole('button', { name: /Cassandra Goth/ }))
    expect(onSelectSim).toHaveBeenCalledWith('heir')
  })

  it('renders the heir crown for the heir only', () => {
    renderTree()
    expect(screen.getAllByTestId('heir-crown')).toHaveLength(1)
  })

  it('fades nodes whose id is in dimmedIds (search highlight)', () => {
    const { container } = renderTree({ dimmedIds: new Set(['spouse']) })
    expect(container.querySelectorAll('[data-tree-node][data-dimmed]')).toHaveLength(1)
  })

  it('renders nothing when there are no sims', () => {
    const { container } = render(
      <ReactFlowProvider>
        <LineageFlow sims={[]} familyEdges={[]} partnerEdges={[]} />
      </ReactFlowProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('does not throw or pan when node focus fires before canvas is measured (jsdom has no dimensions)', async () => {
    // jsdom never gives the canvas real pixel dimensions, so store.getState()
    // returns width:0/height:0. The guard in handleNodeFocus must short-circuit
    // rather than calling setCenter (which would divide by zero and/or pan to NaN).
    // This test asserts the component stays stable — no error thrown, tree still rendered.
    const user = userEvent.setup()
    const onSelectSim = vi.fn()
    const { container } = renderTree({ onSelectSim })

    // Capture the xyflow viewport element and its transform before the click.
    // If the guard is removed, setCenter with zero canvas dims would poison this
    // transform with NaN (width/2 − x·zoom reduces to 0 when width=0, but
    // panZoom.setViewport is called which updates the CSS transform and can
    // produce translate(NaN,NaN) when the internal d3 scale is uninitialised).
    const viewport = container.querySelector('.react-flow__viewport')
    expect(viewport).not.toBeNull()
    const transformBefore = viewport!.getAttribute('style') ?? ''

    // Clicking the button calls onNodeFocus internally (via toFlowGraph) before onSelect.
    await user.click(screen.getByRole('button', { name: /Bella Goth/ }))

    // The viewport transform must be unchanged and must not contain NaN.
    const transformAfter = viewport!.getAttribute('style') ?? ''
    expect(transformAfter).toBe(transformBefore)
    expect(transformAfter).not.toContain('NaN')

    // The tree remains intact; onSelectSim was called — no crash means the guard worked.
    expect(onSelectSim).toHaveBeenCalledWith('founder')
    expect(screen.getByRole('group', { name: 'Goth tree — 3 sims' })).toBeInTheDocument()
  })

  it('omits aria-roledescription from rendered crest node wrappers', () => {
    // xyflow sets aria-roledescription="node" on every wrapper, but crest nodes
    // have nodesFocusable=false (no role) which makes that a WAI-ARIA violation.
    // The suppression via domAttributes: { 'aria-roledescription': undefined }
    // causes React to omit the attribute entirely from the rendered DOM.
    const { container } = renderTree()
    // Crest wrappers are identified by their xyflow data-testid pattern.
    const crestWrappers = sims.map((s) => container.querySelector(`[data-testid="rf__node-${s.id}"]`))
    for (const wrapper of crestWrappers) {
      expect(wrapper).not.toBeNull()
      expect(wrapper).not.toHaveAttribute('aria-roledescription')
    }
  })
})
