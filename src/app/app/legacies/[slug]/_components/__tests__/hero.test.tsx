// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hero } from '../hero/hero'
import type { LegacyStats, ChronicleSim } from '../../lib/types'

vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => (
    <span data-testid="portrait-image" aria-label={alt} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const stats: LegacyStats = {
  sims: 12,
  generations: 3,
  households: 4,
  milestones: 47,
}

const founder: ChronicleSim = {
  id: 'dina',
  firstName: 'Dina',
  lastName: 'Caliente',
  imageUrl: null,
  generationNumber: 1,
  lifeStage: 'ADULT',
  isHeir: false,
  isFounder: true,
  aspirationName: 'Soulmate',
}

const heir: ChronicleSim = {
  id: 'reed',
  firstName: 'Reed',
  lastName: 'Caliente',
  imageUrl: null,
  generationNumber: 3,
  lifeStage: 'YOUNG_ADULT',
  isHeir: true,
  isFounder: false,
  aspirationName: 'Renaissance Sim',
}

describe('Hero', () => {
  it('renders the H1 with the full legacy name', () => {
    render(
      <Hero
        name="The Caliente Legacy"
        description={null}
        stats={stats}
        slug="caliente"
        founder={null}
        currentHeir={null}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The Caliente Legacy')
  })

  it('renders the H1 with the full name when it does not end in "Legacy"', () => {
    render(
      <Hero
        name="The Caliente Chronicle"
        description={null}
        stats={stats}
        slug="caliente"
        founder={null}
        currentHeir={null}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('The Caliente Chronicle')
  })

  it('renders all four stat values', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
        slug="caliente"
        founder={founder}
        currentHeir={null}
      />,
    )
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
  })

  it('renders the brand-new card with founder and heir ghost slots when empty', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={{ sims: 0, generations: 0, households: 0, milestones: 0 }}
        slug="caliente"
        founder={null}
        currentHeir={null}
      />,
    )
    expect(screen.getByText('Now & then')).toBeInTheDocument()
    expect(screen.getByText('Founder · Gen I')).toBeInTheDocument()
    expect(screen.getByText('No heir yet')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Add your founder/i }),
    ).toHaveAttribute('href', '/app/legacies/caliente/sims/new')
  })

  it('renders em-dash muted stats for a brand-new legacy (no founder)', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={{ sims: 0, generations: 0, households: 0, milestones: 0 }}
        slug="caliente"
        founder={null}
        currentHeir={null}
      />,
    )
    expect(screen.getAllByText('—')).toHaveLength(4)
    expect(screen.queryByText('0')).toBeNull()
  })

  it('shows a heir ghost slot when a founder exists but no heir', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={{ sims: 1, generations: 1, households: 1, milestones: 1 }}
        slug="caliente"
        founder={founder}
        currentHeir={null}
      />,
    )
    expect(screen.getByText('Dina Caliente')).toBeInTheDocument()
    expect(screen.getByText('No heir yet')).toBeInTheDocument()
  })

  it('renders the Now & then card when founder is provided', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
        slug="caliente"
        founder={founder}
        currentHeir={null}
      />,
    )
    expect(screen.getByText('Now & then')).toBeInTheDocument()
    expect(screen.getByText('Founder · Gen I')).toBeInTheDocument()
  })

  it('renders the Now & then card when only heir is provided', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
        slug="caliente"
        founder={null}
        currentHeir={heir}
      />,
    )
    expect(screen.getByText('Now & then')).toBeInTheDocument()
    expect(screen.getByText('Current heir · Gen III')).toBeInTheDocument()
  })

  it('drops the generation suffix for an heir with a null generationNumber', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
        slug="caliente"
        founder={null}
        currentHeir={{ ...heir, generationNumber: null }}
      />,
    )
    expect(screen.getByText('Current heir')).toBeInTheDocument()
    expect(screen.queryByText(/Current heir · Gen/)).not.toBeInTheDocument()
  })

  it('renders the treeSlot when provided', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
        slug="caliente"
        founder={null}
        currentHeir={null}
        treeSlot={<button>View family tree</button>}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'View family tree' }),
    ).toBeInTheDocument()
  })

  it('shows the description when provided and hides it when null', () => {
    const { rerender } = render(
      <Hero
        name="Test Legacy"
        description="A great family story."
        stats={stats}
        slug="caliente"
        founder={null}
        currentHeir={null}
      />,
    )
    expect(screen.getByText('A great family story.')).toBeInTheDocument()

    rerender(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
        slug="caliente"
        founder={null}
        currentHeir={null}
      />,
    )
    expect(
      screen.queryByText('A great family story.'),
    ).not.toBeInTheDocument()
  })

  it('renders both founder and heir columns with a divider when both are provided', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
        slug="caliente"
        founder={founder}
        currentHeir={heir}
      />,
    )
    expect(screen.getByText('Founder · Gen I')).toBeInTheDocument()
    expect(screen.getByText('Current heir · Gen III')).toBeInTheDocument()
    // Both names visible
    expect(screen.getByText('Dina Caliente')).toBeInTheDocument()
    expect(screen.getByText('Reed Caliente')).toBeInTheDocument()
  })
})
