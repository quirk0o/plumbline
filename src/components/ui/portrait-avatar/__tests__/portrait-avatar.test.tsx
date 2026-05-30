// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PortraitAvatar } from '../portrait-avatar'

vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => (
    <span data-testid="portrait-image" aria-label={alt} />
  ),
}))

vi.mock('next/link', () => ({
  default: (props: {
    href: string
    children: React.ReactNode
    className?: string
    'aria-label'?: string
  }) => (
    <a href={props.href} className={props.className} aria-label={props['aria-label']}>
      {props.children}
    </a>
  ),
}))

describe('PortraitAvatar', () => {
  it('renders monogram initials when imageUrl is null', () => {
    render(
      <PortraitAvatar imageUrl={null} firstName="Dina" lastName="Caliente" />
    )
    expect(screen.getByText('DC')).toBeInTheDocument()
    expect(screen.queryByTestId('portrait-image')).not.toBeInTheDocument()
  })

  it('renders image and hides initials when imageUrl is provided', () => {
    render(
      <PortraitAvatar
        imageUrl="https://example.com/dina.jpg"
        firstName="Dina"
        lastName="Caliente"
      />
    )
    const img = screen.getByTestId('portrait-image')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('aria-label', 'Dina Caliente')
    expect(screen.queryByText('DC')).not.toBeInTheDocument()
  })

  it('applies accent box-shadow for ring="founder"', () => {
    const { container } = render(
      <PortraitAvatar imageUrl={null} firstName="Bob" lastName="Pancakes" ring="founder" />
    )
    const avatar = container.firstChild as HTMLElement
    expect(avatar.style.boxShadow).toContain('var(--amber)')
  })

  it('does not apply accent box-shadow for ring="green"', () => {
    const { container } = render(
      <PortraitAvatar imageUrl={null} firstName="Bob" lastName="Pancakes" ring="green" />
    )
    const avatar = container.firstChild as HTMLElement
    expect(avatar.style.boxShadow).toBe('')
  })

  it('renders a link to the sim when href is provided', () => {
    render(
      <PortraitAvatar
        imageUrl={null}
        firstName="Dina"
        lastName="Caliente"
        href="/app/legacies/caliente/sims/dina"
      />
    )
    const link = screen.getByRole('link', { name: 'View Dina Caliente' })
    expect(link).toHaveAttribute('href', '/app/legacies/caliente/sims/dina')
    // The monogram still renders inside the link.
    expect(screen.getByText('DC')).toBeInTheDocument()
  })

  it('does not render a link when href is absent', () => {
    render(<PortraitAvatar imageUrl={null} firstName="Dina" lastName="Caliente" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  // Entity initials must read upright, not italic — the monogram is a person's
  // name, and the brand reserves italic for blockquotes and inline book titles.
  it('renders the monogram fallback upright (no italic)', () => {
    const moduleCss = readFileSync(
      join(process.cwd(), 'src/components/ui/portrait-avatar/portrait-avatar.module.css'),
      'utf8',
    )
    const monogramBlock = moduleCss.match(/\.monogram\s*\{([^}]*)\}/)
    expect(monogramBlock, '.monogram rule missing from module CSS').not.toBeNull()
    expect(monogramBlock![1]).not.toMatch(/font-style:\s*italic/)
  })
})
