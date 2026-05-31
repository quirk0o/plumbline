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
  it('renders the designed empty state when steps is empty', () => {
    render(<Succession steps={[]} slug="caliente" />)
    // Headline (the italic accent word "trace" is part of the heading text).
    expect(
      screen.getByRole('heading', { name: /No succession to\s*trace\s*yet\./i }),
    ).toBeInTheDocument()
    // Body copy.
    expect(
      screen.getByText(/Name an heir and the line draws itself/i),
    ).toBeInTheDocument()
    // CTA is present as a button (no action wired yet — see plan decision 2).
    expect(
      screen.getByRole('button', { name: /Name an heir/i }),
    ).toBeInTheDocument()
  })

  it('does not render the empty state when steps are present', () => {
    render(<Succession steps={[founder]} slug="caliente" />)
    expect(screen.queryByRole('button', { name: /Name an heir/i })).toBeNull()
    expect(screen.getByText('Dina Caliente')).toBeInTheDocument()
  })

  it('renders one role label per step', () => {
    render(<Succession steps={[founder, heir]} slug="caliente" />)
    expect(screen.getByText('Founder')).toBeInTheDocument()
    expect(screen.getByText('Heir designate')).toBeInTheDocument()
  })

  it('renders the sim names for each step', () => {
    render(<Succession steps={[founder, heir]} slug="caliente" />)
    expect(screen.getByText('Dina Caliente')).toBeInTheDocument()
    expect(screen.getByText('Reed Caliente')).toBeInTheDocument()
  })

  it('renders the section heading', () => {
    render(<Succession steps={[]} slug="caliente" />)
    expect(
      screen.getByRole('heading', { name: 'Succession line' }),
    ).toBeInTheDocument()
  })
})
