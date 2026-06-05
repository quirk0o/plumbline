// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Shared spies for the xyflow imperative API so tests can assert on the
// zoom-bar wiring (hoisted, like mockUseQuery below).
const { mockZoomIn, mockZoomOut, mockFitView } = vi.hoisted(() => ({
  mockZoomIn: vi.fn(),
  mockZoomOut: vi.fn(),
  mockFitView: vi.fn(),
}))

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
    fitView: mockFitView,
  }),
  useViewport: () => ({ zoom: 1, x: 0, y: 0 }),
}))

vi.mock('@/components/lineage-tree/lineage-flow', () => ({
  LineageFlow: ({ onSelectSim }: { onSelectSim?: (id: string) => void }) => (
    <button type="button" data-testid="lineage-flow" onClick={() => onSelectSim?.('s2')}>
      tree
    </button>
  ),
}))

vi.mock('../sim-inspector', () => ({
  SimInspector: ({ simId }: { simId: string }) => (
    <div data-testid="sim-inspector">{simId}</div>
  ),
}))

const { mockUseQuery } = vi.hoisted(() => ({ mockUseQuery: vi.fn() }))

vi.mock('@/trpc/client', () => ({
  trpc: {
    sims: {
      getTreeData: {
        useQuery: mockUseQuery,
      },
    },
  },
}))

// Import AFTER mocks are set up
import { TreeAtlas } from '../tree-atlas'

const defaultProps = {
  legacySlug: 'caliente',
  legacyName: 'The Caliente Legacy',
  founderSimId: 'founder-1',
}

const TWO_SIMS = {
  data: {
    sims: [
      { id: 's1', firstName: 'Dina', lastName: 'Caliente', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false, href: '/app/legacies/caliente/sims/s1' },
      { id: 's2', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 2, lifeStage: 'TEEN', isHeir: true, href: '/app/legacies/caliente/sims/s2' },
    ],
    familyEdges: [],
    partnerEdges: [],
  },
  isLoading: false,
  isError: false,
}

describe('TreeAtlas (full-page route, not a dialog)', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue(TWO_SIMS)
  })

  it('renders as a page — no modal dialog', () => {
    render(<TreeAtlas {...defaultProps} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the legacy title as a heading', () => {
    render(<TreeAtlas {...defaultProps} />)
    expect(
      screen.getByRole('heading', { name: 'The Caliente Legacy' }),
    ).toBeInTheDocument()
  })

  it('renders the floating capsule counts and a back link to the chronicle', () => {
    render(<TreeAtlas {...defaultProps} />)
    expect(screen.getByText(/2 sims · 2 generations/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to legacy/i })).toHaveAttribute(
      'href',
      '/app/legacies/caliente',
    )
  })

  it('renders the generation filter pills and the Add sim link', () => {
    render(<TreeAtlas {...defaultProps} />)
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Gen I' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add sim/i })).toHaveAttribute(
      'href',
      '/app/legacies/caliente/sims/new',
    )
  })

  it('shows the tree when data resolves', () => {
    render(<TreeAtlas {...defaultProps} />)
    expect(screen.getByTestId('lineage-flow')).toBeInTheDocument()
  })

  it('shows a loading state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<TreeAtlas {...defaultProps} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    // The capsule + back link are still present while loading.
    expect(screen.getByRole('link', { name: /back to legacy/i })).toBeInTheDocument()
  })

  it('shows an error state (and keeps the back link)', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<TreeAtlas {...defaultProps} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to legacy/i })).toBeInTheDocument()
  })

  it('shows an empty state when the legacy has no sims', () => {
    mockUseQuery.mockReturnValue({
      data: { sims: [], familyEdges: [], partnerEdges: [] },
      isLoading: false,
      isError: false,
    })
    render(<TreeAtlas {...defaultProps} />)
    expect(screen.getByText(/no sims to chart yet/i)).toBeInTheDocument()
    expect(screen.queryByTestId('lineage-flow')).not.toBeInTheDocument()
  })

  it('opens the sim inspector when a node is selected', async () => {
    const user = userEvent.setup()
    render(<TreeAtlas {...defaultProps} />)
    expect(screen.queryByTestId('sim-inspector')).not.toBeInTheDocument()
    await user.click(screen.getByTestId('lineage-flow'))
    expect(screen.getByTestId('sim-inspector')).toHaveTextContent('s2')
  })

  it('hides the zoom bar (no phantom Fit control) when a gen filter has no sims', async () => {
    const user = userEvent.setup()
    // Gen II's only sim disappears from the data while the user has Gen II
    // selected, so visibleSims is empty but the legacy still has sims overall.
    const GEN_TWO_EMPTIED = {
      ...TWO_SIMS,
      data: {
        ...TWO_SIMS.data,
        sims: [TWO_SIMS.data.sims[0]], // only the Gen I sim remains
      },
    }
    const { rerender } = render(<TreeAtlas {...defaultProps} />)

    // Both Fit and the tree are present while Gen II has a sim.
    await user.click(screen.getByRole('button', { name: 'Gen II' }))
    expect(screen.getByRole('button', { name: /fit tree to view/i })).toBeInTheDocument()
    expect(screen.getByTestId('lineage-flow')).toBeInTheDocument()

    // After the Gen II sim is gone, the filter yields nothing.
    mockUseQuery.mockReturnValue(GEN_TWO_EMPTIED)
    rerender(<TreeAtlas {...defaultProps} />)

    expect(screen.getByText(/no sims in this generation/i)).toBeInTheDocument()
    expect(screen.queryByTestId('lineage-flow')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /fit tree to view/i }),
    ).not.toBeInTheDocument()
  })
})
