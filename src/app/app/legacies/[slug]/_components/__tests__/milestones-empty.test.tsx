// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Milestones } from '../milestones/milestones'

vi.mock('next/link', () => ({
  default: (props: { href: string; children: React.ReactNode }) => (
    <a href={props.href}>{props.children}</a>
  ),
}))

describe('Milestones — empty state', () => {
  it('renders the designed empty state when there are no milestones', () => {
    render(<Milestones milestones={[]} simsById={{}} slug="caliente" />)
    expect(
      screen.getByRole('heading', { name: /No moments\s*recorded\s*yet\./i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Births and weddings log themselves/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Record a moment/i }),
    ).toBeInTheDocument()
  })

  it('does NOT render a white "Add milestone" composer box', () => {
    // The white composer card from the design is intentionally not ported
    // (milestones are auto-derived; there is no manual-entry feature).
    render(<Milestones milestones={[]} simsById={{}} slug="caliente" />)
    expect(
      screen.queryByRole('button', { name: /Add milestone/i }),
    ).toBeNull()
  })
})
