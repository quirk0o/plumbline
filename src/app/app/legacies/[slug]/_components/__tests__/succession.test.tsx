// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Succession } from '../succession/succession'
import type { SuccessionStep } from '../../lib/types'

vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => (
    <span data-testid="portrait-image" aria-label={alt} />
  ),
}))

const founder: SuccessionStep = {
  sim: {
    id: 'dina',
    firstName: 'Dina',
    lastName: 'Caliente',
    imageUrl: null,
    generationNumber: 1,
    lifeStage: 'ADULT',
    isHeir: false,
    isFounder: true,
    aspirationName: null,
  },
  role: 'Founder',
  isHeir: false,
  isFounder: true,
}

const heir: SuccessionStep = {
  sim: {
    id: 'reed',
    firstName: 'Reed',
    lastName: 'Caliente',
    imageUrl: null,
    generationNumber: 3,
    lifeStage: 'YOUNG_ADULT',
    isHeir: true,
    isFounder: false,
    aspirationName: null,
  },
  role: 'Heir designate',
  isHeir: true,
  isFounder: false,
}

describe('Succession', () => {
  it('renders the empty-state sentence when steps is empty', () => {
    render(<Succession steps={[]} />)
    expect(
      screen.getByText('No succession line yet — name an heir to begin.'),
    ).toBeInTheDocument()
  })

  it('does not render the empty state when steps are present', () => {
    render(<Succession steps={[founder]} />)
    expect(
      screen.queryByText('No succession line yet — name an heir to begin.'),
    ).not.toBeInTheDocument()
  })

  it('renders one role label per step', () => {
    render(<Succession steps={[founder, heir]} />)
    expect(screen.getByText('Founder')).toBeInTheDocument()
    expect(screen.getByText('Heir designate')).toBeInTheDocument()
  })

  it('renders the sim names for each step', () => {
    render(<Succession steps={[founder, heir]} />)
    expect(screen.getByText('Dina Caliente')).toBeInTheDocument()
    expect(screen.getByText('Reed Caliente')).toBeInTheDocument()
  })

  it('renders the section heading', () => {
    render(<Succession steps={[]} />)
    expect(
      screen.getByRole('heading', { name: 'Succession line' }),
    ).toBeInTheDocument()
  })
})
