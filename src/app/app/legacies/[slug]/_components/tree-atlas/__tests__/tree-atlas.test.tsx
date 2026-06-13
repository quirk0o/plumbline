// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// tRPC is the one internal seam we mock (the in-browser transport boundary).
// The real LineageFlow and SimInspector children render for real, so we must
// satisfy BOTH the tree query they sit on top of and the per-sim detail query
// the inspector fires when a node is selected.
const { mockTreeQuery, mockGetById } = vi.hoisted(() => ({
  mockTreeQuery: vi.fn(),
  mockGetById: vi.fn(),
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    sims: {
      getTreeData: { useQuery: mockTreeQuery },
      getById: { useQuery: mockGetById },
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

// Full LineageFlowSim shape (the real renderer needs isDeceased + gender).
const TWO_SIMS = {
  data: {
    sims: [
      {
        id: 's1',
        firstName: 'Dina',
        lastName: 'Caliente',
        imageUrl: null,
        generationNumber: 1,
        lifeStage: 'ADULT',
        isHeir: false,
        isDeceased: false,
        gender: 'FEMALE',
      },
      {
        id: 's2',
        firstName: 'Reed',
        lastName: 'Caliente',
        imageUrl: null,
        generationNumber: 2,
        lifeStage: 'TEEN',
        isHeir: true,
        isDeceased: false,
        gender: 'MALE',
      },
    ],
    familyEdges: [],
    partnerEdges: [],
  },
  isLoading: false,
  isError: false,
}

// The sim the inspector resolves when its node is clicked. Relation arrays are
// empty so the real SimInspector renders its detail view (not loading/error).
const DINA_DETAIL = {
  data: {
    id: 's1',
    firstName: 'Dina',
    lastName: 'Caliente',
    imageUrl: null,
    generationNumber: 1,
    lifeStage: 'ADULT',
    isHeir: false,
    personalityTraits: [],
    aspirations: [],
    childOf: [],
    socialRelationshipsA: [],
    socialRelationshipsB: [],
  },
  isLoading: false,
  isError: false,
}

function renderAtlas(props = defaultProps) {
  return render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <TreeAtlas {...props} />
      </div>
    </ReactFlowProvider>,
  )
}

describe('TreeAtlas (full-page route, not a dialog)', () => {
  beforeEach(() => {
    mockTreeQuery.mockReturnValue(TWO_SIMS)
    mockGetById.mockReturnValue(DINA_DETAIL)
  })

  it('renders as a page — no modal dialog', () => {
    renderAtlas()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the legacy title as a heading', () => {
    renderAtlas()
    expect(
      screen.getByRole('heading', { name: 'The Caliente Legacy' }),
    ).toBeInTheDocument()
  })

  it('renders the floating capsule counts and a back link to the chronicle', () => {
    renderAtlas()
    expect(screen.getByText(/2 sims · 2 generations/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to legacy/i })).toHaveAttribute(
      'href',
      '/app/legacies/caliente',
    )
  })

  it('renders the generation filter pills and the Add sim link', () => {
    renderAtlas()
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Gen I' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add sim/i })).toHaveAttribute(
      'href',
      '/app/legacies/caliente/sims/new',
    )
  })

  it('shows the tree when data resolves', () => {
    renderAtlas()
    // The founder's own crest label is never overridden by a kinship term, but
    // querying by name only stays robust regardless.
    expect(screen.getByRole('button', { name: /Dina Caliente/ })).toBeInTheDocument()
  })

  it('shows a loading state', () => {
    mockTreeQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    renderAtlas()
    expect(screen.getByRole('status')).toBeInTheDocument()
    // The capsule + back link are still present while loading.
    expect(screen.getByRole('link', { name: /back to legacy/i })).toBeInTheDocument()
  })

  it('shows an error state (and keeps the back link)', () => {
    mockTreeQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    renderAtlas()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to legacy/i })).toBeInTheDocument()
  })

  it('shows an empty state when the legacy has no sims', () => {
    mockTreeQuery.mockReturnValue({
      data: { sims: [], familyEdges: [], partnerEdges: [] },
      isLoading: false,
      isError: false,
    })
    renderAtlas()
    expect(screen.getByText(/no sims to chart yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Dina Caliente/ })).not.toBeInTheDocument()
  })

  it('opens the sim inspector when a node is selected', async () => {
    const user = userEvent.setup()
    renderAtlas()
    expect(
      screen.queryByRole('complementary', { name: /Dina Caliente details/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Dina Caliente/ }))

    expect(
      await screen.findByRole('complementary', { name: /Dina Caliente details/i }),
    ).toBeInTheDocument()
  })

  it('shows the fit-to-view control when the tree has sims', () => {
    renderAtlas()
    expect(screen.getByRole('button', { name: /fit tree to view/i })).toBeInTheDocument()
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
    const { rerender } = renderAtlas()

    // Both Fit and a tree node are present while Gen II has a sim.
    await user.click(screen.getByRole('button', { name: 'Gen II' }))
    expect(screen.getByRole('button', { name: /fit tree to view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reed Caliente/ })).toBeInTheDocument()

    // After the Gen II sim is gone, the filter yields nothing.
    mockTreeQuery.mockReturnValue(GEN_TWO_EMPTIED)
    rerender(
      <ReactFlowProvider>
        <div style={{ width: 800, height: 600 }}>
          <TreeAtlas {...defaultProps} />
        </div>
      </ReactFlowProvider>,
    )

    expect(screen.getByText(/no sims in this generation/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reed Caliente/ })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /fit tree to view/i }),
    ).not.toBeInTheDocument()
  })
})
