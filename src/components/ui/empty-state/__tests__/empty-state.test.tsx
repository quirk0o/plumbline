// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../empty-state'

describe('EmptyState', () => {
  it('renders the message text', () => {
    render(<EmptyState>No sims yet.</EmptyState>)
    expect(screen.getByText('No sims yet.')).toBeInTheDocument()
  })

  it('renders an optional action alongside the message', () => {
    render(
      <EmptyState action={<a href="/x">Add a sim</a>}>No sims yet.</EmptyState>
    )
    expect(screen.getByText('No sims yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a sim' })).toBeInTheDocument()
  })
})
