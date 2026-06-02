// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GhostCircle } from '../ghost-circle'

describe('GhostCircle', () => {
  it('renders the icon it wraps', () => {
    render(
      <GhostCircle>
        <svg data-testid="inner-icon" />
      </GhostCircle>,
    )
    expect(screen.getByTestId('inner-icon')).toBeInTheDocument()
  })

  it('applies the requested size as inline width/height', () => {
    const { container } = render(<GhostCircle size={88} />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveStyle({ width: '88px', height: '88px' })
  })

  it('defaults to 72px when no size is given', () => {
    const { container } = render(<GhostCircle />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveStyle({ width: '72px', height: '72px' })
  })
})
