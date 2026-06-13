// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ThemeProvider } from '@/components/theme-provider'
import { AppShell } from '../components/app-shell'

// AppShell renders AppNav, a client component that reads the pathname and can
// trigger sign-out. The async AppLayout itself can't render in jsdom (it awaits
// auth() and may redirect), so we assert the shell's accessibility semantics
// here — the layout simply forwards the session into this same shell.
vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
}))
vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
}))

function renderShell() {
  return render(
    <ThemeProvider>
      <AppShell name="Ada" email="ada@example.com" image={null}>
        <div>Page content</div>
      </AppShell>
    </ThemeProvider>,
  )
}

describe('app shell accessibility', () => {
  it('renders a skip-to-content link targeting #main-content', () => {
    renderShell()
    const skip = screen.getByRole('link', { name: /skip to (main )?content/i })
    expect(skip.getAttribute('href')).toBe('#main-content')
  })

  it('labels the top navigation', () => {
    renderShell()
    const navs = screen.getAllByRole('navigation')
    expect(
      navs.some((n) => /main|primary/i.test(n.getAttribute('aria-label') ?? '')),
    ).toBe(true)
  })

  it('marks the main content region with the skip-link target id', () => {
    renderShell()
    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('id', 'main-content')
  })
})
