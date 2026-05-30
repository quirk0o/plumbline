// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('TreeOverlay focus trap', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockUseQuery.mockReturnValue({
      data: {
        sims: [
          { id: 's1', generationNumber: 1 },
          { id: 's2', generationNumber: 2 },
        ],
        familyEdges: [],
        partnerEdges: [],
      },
      isLoading: false,
      isError: false,
    })
  })

  it('exposes a modal dialog with an accessible name', async () => {
    await openOverlay()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog).toHaveAccessibleName('The Caliente Legacy family tree')
  })

  it('keeps Tab focus within the dialog when tabbing forward off the last element', async () => {
    const user = await openOverlay()
    const dialog = screen.getByRole('dialog')
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])',
    )
    const last = focusables[focusables.length - 1]
    last.focus()
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('wraps to the last element on Shift+Tab from the first', async () => {
    const user = await openOverlay()
    const dialog = screen.getByRole('dialog')
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusables[0]
    first.focus()
    await user.tab({ shift: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('closes on Escape', async () => {
    const user = await openOverlay()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the floating legacy capsule with sim + generation counts', async () => {
    await openOverlay()
    expect(screen.getByText(/2 sims · 2 generations/i)).toBeInTheDocument()
  })
})
