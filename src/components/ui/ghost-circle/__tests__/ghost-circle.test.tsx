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
})
