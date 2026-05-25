// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PortraitAvatar } from '../portrait-avatar'

vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => (
    <span data-testid="portrait-image" aria-label={alt} />
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
})
