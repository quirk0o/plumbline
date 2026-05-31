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

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/app',
}))

vi.mock('@/components/lineage-tree/lineage-tree', () => ({
  LineageTree: ({ onSelectSim }: { onSelectSim?: (id: string) => void }) => (
    <button type="button" data-testid="lineage-tree" onClick={() => onSelectSim?.('s2')}>
      tree
    </button>
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
    mockPush.mockReset()
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
    expect(screen.getByTestId('lineage-tree')).toBeInTheDocument()
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
    expect(screen.queryByTestId('lineage-tree')).not.toBeInTheDocument()
  })

  it('navigates to the sim detail route when a node is selected', async () => {
    const user = userEvent.setup()
    render(<TreeAtlas {...defaultProps} />)
    await user.click(screen.getByTestId('lineage-tree'))
    expect(mockPush).toHaveBeenCalledWith('/app/legacies/caliente/sims/s2')
  })
})
