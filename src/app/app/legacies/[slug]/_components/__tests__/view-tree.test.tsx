// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => <span>{alt}</span>,
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/app',
}))

// next-auth is used inside AppNav (signOut)
vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

vi.mock('@/app/app/components/app-nav', () => ({
  AppNav: () => <nav data-testid="app-nav" />,
}))

vi.mock('@/components/lineage-tree/lineage-tree', () => ({
  LineageTree: ({
    onSelectSim,
  }: {
    sims: unknown[]
    familyEdges: unknown[]
    partnerEdges: unknown[]
    dimmedIds?: Set<string>
    onSelectSim?: (id: string) => void
  }) => (
    <div
      data-testid="lineage-tree"
      onClick={() => onSelectSim?.('sim-abc')}
    />
  ),
}))

// Stub ThemeToggle (used inside AppNav stub — actually mocked above, but
// some test environments still resolve it)
vi.mock('@/components/theme-provider', () => ({
  ThemeToggle: () => null,
}))

const { mockUseQuery } = vi.hoisted(() => {
  const mockUseQuery = vi.fn()
  return { mockUseQuery }
})

vi.mock('@/trpc/client', () => ({
  trpc: {
    sims: {
      getTreeData: {
        useQuery: mockUseQuery,
      },
    },
  },
}))

const defaultProps = {
  legacySlug: 'caliente',
  legacyName: 'The Caliente Legacy',
  founderSimId: 'founder-1',
  name: 'Beata',
  email: 'beata@test.com',
  image: null,
}

// Import AFTER mocks are set up
import { ViewTree } from '../view-tree/view-tree'

describe('ViewTree', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
  })

  it('renders the trigger button with correct label', () => {
    render(<ViewTree {...defaultProps} />)
    expect(
      screen.getByRole('button', { name: /view family tree/i }),
    ).toBeInTheDocument()
  })

  it('does not show the overlay initially', () => {
    render(<ViewTree {...defaultProps} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the overlay when the trigger button is clicked', async () => {
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByRole('dialog', { name: 'The Caliente Legacy' })).toBeInTheDocument()
  })

  it('closes the overlay when "Back to legacy" button is clicked', async () => {
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /back to legacy/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the overlay when Escape is pressed', async () => {
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('TreeOverlay (via ViewTree)', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  it('shows loading state when data is loading', async () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/loading the family tree/i)).toBeInTheDocument()
  })

  it('shows an error message (and keeps the back button) when the query errors', async () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(
      screen.getByText(/could not load the family tree/i),
    ).toBeInTheDocument()
    // The user can still escape the overlay via the always-present back button
    expect(
      screen.getByRole('button', { name: /back to legacy/i }),
    ).toBeInTheDocument()
  })

  it('shows an empty message when the legacy has no sims', async () => {
    mockUseQuery.mockReturnValue({
      data: { sims: [], familyEdges: [], partnerEdges: [] },
      isLoading: false,
      isError: false,
    })
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByText(/no sims to chart yet/i)).toBeInTheDocument()
    expect(screen.queryByTestId('lineage-tree')).not.toBeInTheDocument()
  })

  it('shows the LineageTree stub when data resolves', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        sims: [{ id: 'sim-1', firstName: 'Dina', lastName: 'Caliente', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false, href: '/app/legacies/caliente/sims/sim-1' }],
        familyEdges: [],
        partnerEdges: [],
      },
      isLoading: false,
      isError: false,
    })
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByTestId('lineage-tree')).toBeInTheDocument()
  })

  it('renders the legacy title as the dialog accessible name when name ends in "Legacy"', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        sims: [{ id: 's1', firstName: 'Dina', lastName: 'Caliente', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false, href: '/app/legacies/caliente/sims/s1' }],
        familyEdges: [],
        partnerEdges: [],
      },
      isLoading: false,
      isError: false,
    })
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} legacyName="The Caliente Legacy" />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))

    // The RadixDialog.Title provides the accessible name; the trailing word
    // "Legacy" is rendered as a span accent — not an <em>
    expect(screen.getByRole('dialog', { name: 'The Caliente Legacy' })).toBeInTheDocument()
  })

  it('renders the full dialog title when name does not end in "Legacy"', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        sims: [{ id: 's1', firstName: 'Dina', lastName: 'Caliente', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false, href: '/app/legacies/caliente/sims/s1' }],
        familyEdges: [],
        partnerEdges: [],
      },
      isLoading: false,
      isError: false,
    })
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} legacyName="The Caliente Chronicle" />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))

    expect(screen.getByRole('dialog', { name: 'The Caliente Chronicle' })).toBeInTheDocument()
  })

  it('navigates to sim detail route when a tree node is selected', async () => {
    mockUseQuery.mockReturnValue({
      data: {
        sims: [{ id: 'sim-abc', firstName: 'Dina', lastName: 'Caliente', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false, href: '/app/legacies/caliente/sims/sim-abc' }],
        familyEdges: [],
        partnerEdges: [],
      },
      isLoading: false,
      isError: false,
    })
    const user = userEvent.setup()
    render(<ViewTree {...defaultProps} legacySlug="caliente" />)
    await user.click(screen.getByRole('button', { name: /view family tree/i }))

    // Simulate the LineageTree stub calling onSelectSim('sim-abc') via click
    fireEvent.click(screen.getByTestId('lineage-tree'))

    expect(mockPush).toHaveBeenCalledWith(
      '/app/legacies/caliente/sims/sim-abc',
    )
  })
})
