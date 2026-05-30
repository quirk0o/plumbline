// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => <span>{alt}</span>,
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/app',
}))

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

// Give the AppNav stub a real focusable element so the trap has >1 target.
vi.mock('@/app/app/components/app-nav', () => ({
  AppNav: () => (
    <nav data-testid="app-nav">
      <a href="/app">Home</a>
    </nav>
  ),
}))

vi.mock('@/components/lineage-tree/lineage-tree', () => ({
  LineageTree: () => <div data-testid="lineage-tree" />,
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
import { ViewTree } from '../../view-tree/view-tree'

const defaultProps = {
  legacySlug: 'caliente',
  legacyName: 'The Caliente Legacy',
  founderSimId: 'founder-1',
  name: 'Beata',
  email: 'beata@test.com',
  image: null,
}

async function openOverlay() {
  const user = userEvent.setup()
  render(<ViewTree {...defaultProps} />)
  await user.click(screen.getByRole('button', { name: /view family tree/i }))
  return user
}

describe('TreeOverlay (Radix modal atlas)', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockUseQuery.mockReturnValue({
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
    })
  })

  it('exposes a modal dialog named by its visible legacy title', async () => {
    await openOverlay()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('data-state')).toBe('open')
    expect(dialog).toHaveAccessibleName('The Caliente Legacy')
  })

  it('keeps the atlas AppNav inside the dialog', async () => {
    await openOverlay()
    expect(within(screen.getByRole('dialog')).getByTestId('app-nav')).toBeInTheDocument()
  })

  it('hides the rest of the page from assistive tech while open', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <nav aria-label="Main navigation" data-testid="page-nav">
          <a href="/app">Home</a>
        </nav>
        <ViewTree {...defaultProps} />
      </div>,
    )
    await user.click(screen.getByRole('button', { name: /view family tree/i }))
    expect(screen.getByTestId('page-nav').closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('renders the floating capsule with sim + generation counts', async () => {
    await openOverlay()
    expect(screen.getByText(/2 sims · 2 generations/i)).toBeInTheDocument()
  })

  it('renders the generation filter pills and the Add sim link', async () => {
    await openOverlay()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: 'Gen I' })).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /add sim/i })).toHaveAttribute(
      'href',
      '/app/legacies/caliente/sims/new',
    )
  })

  it('closes via the capsule back button', async () => {
    const user = await openOverlay()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /back to legacy/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
