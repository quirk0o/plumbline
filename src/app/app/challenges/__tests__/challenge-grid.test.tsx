// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ChallengeGrid } from '../_components/challenge-grid'

const items = [
  {
    id: 'c1',
    name: 'Legacy Challenge',
    description: 'Ten generations, one lot.',
    isYours: false,
    phaseCount: 10,
  },
  { id: 'c2', name: 'Rags to Riches', description: null, isYours: true, phaseCount: 1 },
]

describe('ChallengeGrid', () => {
  it('renders a card per challenge linking to its detail page', () => {
    render(<ChallengeGrid challenges={items} tab="all" query="" />)
    expect(screen.getByRole('link', { name: /Legacy Challenge/ })).toHaveAttribute(
      'href',
      '/app/challenges/c1',
    )
    expect(screen.getByText('Ten generations, one lot.')).toBeInTheDocument()
  })

  it('shows phase counts (singular and plural) and ownership badges', () => {
    render(<ChallengeGrid challenges={items} tab="all" query="" />)
    expect(screen.getByText('10 phases')).toBeInTheDocument()
    expect(screen.getByText('1 phase')).toBeInTheDocument()
    expect(screen.getByText('Public')).toBeInTheDocument()
    expect(screen.getByText('Yours')).toBeInTheDocument()
  })

  it('shows the no-matches empty state with a clear-search action preserving the tab', () => {
    render(<ChallengeGrid challenges={[]} tab="mine" query="dynasty" />)
    expect(screen.getByText(/No challenges match/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clear search' })).toHaveAttribute(
      'href',
      '/app/challenges?tab=mine',
    )
  })

  it('clear-search on the All tab links to the bare path', () => {
    render(<ChallengeGrid challenges={[]} tab="all" query="dynasty" />)
    expect(screen.getByRole('link', { name: 'Clear search' })).toHaveAttribute(
      'href',
      '/app/challenges',
    )
  })

  it('shows tab-aware copy when there are no challenges at all', () => {
    render(<ChallengeGrid challenges={[]} tab="mine" query="" />)
    expect(screen.getByText(/haven't created any challenges yet/i)).toBeInTheDocument()
  })
})
