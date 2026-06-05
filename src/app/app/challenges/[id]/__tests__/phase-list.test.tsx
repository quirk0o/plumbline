// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PhaseList, type PhaseListPhase } from '../_components/phase-list'

function phase(over: Partial<PhaseListPhase> & { id: string }): PhaseListPhase {
  return {
    title: null,
    generationNumber: null,
    description: null,
    trackers: [],
    ...over,
  }
}

describe('PhaseList', () => {
  it('uses the phase title when present', () => {
    render(<PhaseList phases={[phase({ id: 'p1', title: 'The Founder', generationNumber: 1 })]} />)
    expect(screen.getByRole('heading', { name: 'The Founder' })).toBeInTheDocument()
  })

  it('falls back to "Generation N" when only a generation number is set', () => {
    render(<PhaseList phases={[phase({ id: 'p1', generationNumber: 3 })]} />)
    expect(screen.getByRole('heading', { name: 'Generation 3' })).toBeInTheDocument()
  })

  it('falls back to "Legacy-wide goals" when title and generation are both null', () => {
    render(<PhaseList phases={[phase({ id: 'p1' })]} />)
    expect(screen.getByRole('heading', { name: 'Legacy-wide goals' })).toBeInTheDocument()
  })

  it('lists each tracker as a goal line', () => {
    render(
      <PhaseList
        phases={[
          phase({
            id: 'p1',
            title: 'The Founder',
            description: 'Move in, survive, marry.',
            trackers: [
              { id: 't1', name: 'Max one skill' },
              { id: 't2', name: 'Complete an aspiration' },
            ],
          }),
        ]}
      />,
    )
    expect(screen.getByText('Move in, survive, marry.')).toBeInTheDocument()
    expect(screen.getByText('Max one skill')).toBeInTheDocument()
    expect(screen.getByText('Complete an aspiration')).toBeInTheDocument()
  })

  it('shows a quiet note when there are no phases', () => {
    render(<PhaseList phases={[]} />)
    expect(screen.getByText('This challenge has no phases yet.')).toBeInTheDocument()
  })
})
