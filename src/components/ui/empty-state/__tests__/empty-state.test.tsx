// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from '../empty-state'

describe('EmptyState', () => {
  it('renders the body text from children', () => {
    render(<EmptyState>No sims yet.</EmptyState>)
    expect(screen.getByText('No sims yet.')).toBeInTheDocument()
  })

  it('renders an optional title', () => {
    render(
      <EmptyState title="No moments recorded yet.">Body copy.</EmptyState>,
    )
    expect(
      screen.getByRole('heading', { name: 'No moments recorded yet.' }),
    ).toBeInTheDocument()
  })

  it('renders an optional icon node', () => {
    render(
      <EmptyState icon={<svg data-testid="state-icon" />}>Body.</EmptyState>,
    )
    expect(screen.getByTestId('state-icon')).toBeInTheDocument()
  })

  it('renders an optional action alongside the message', () => {
    render(
      <EmptyState action={<a href="/x">Add a sim</a>}>No sims yet.</EmptyState>,
    )
    expect(screen.getByText('No sims yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add a sim' })).toBeInTheDocument()
  })

  it('renders a title with an italic accent word as a child node', () => {
    render(
      <EmptyState
        title={
          <>
            No moments <em>recorded</em> yet.
          </>
        }
      >
        Body.
      </EmptyState>,
    )
    const heading = screen.getByRole('heading')
    expect(heading.querySelector('em')?.textContent).toBe('recorded')
  })
})
