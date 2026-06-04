// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PortraitAvatar } from '../portrait-avatar'

vi.mock('next/image', () => ({
  default: ({ alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    <img data-testid="portrait-image" aria-label={alt} onError={onError} alt={alt} />
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

  it('marks the avatar as accented for ring="founder"', () => {
    render(
      <PortraitAvatar imageUrl={null} firstName="Bob" lastName="Pancakes" ring="founder" />
    )
    expect(screen.getByTitle('Bob Pancakes')).toHaveAttribute('data-accent')
  })

  it('does not mark the avatar as accented for ring="green"', () => {
    render(
      <PortraitAvatar imageUrl={null} firstName="Bob" lastName="Pancakes" ring="green" />
    )
    expect(screen.getByTitle('Bob Pancakes')).not.toHaveAttribute('data-accent')
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

  it('falls back to the monogram when the image fails to load', () => {
    render(
      <PortraitAvatar
        imageUrl="https://example.com/broken.jpg"
        firstName="Dina"
        lastName="Caliente"
      />
    )
    fireEvent.error(screen.getByTestId('portrait-image'))
    expect(screen.queryByTestId('portrait-image')).not.toBeInTheDocument()
    expect(screen.getByText('DC')).toBeInTheDocument()
  })
})
