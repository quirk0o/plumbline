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
  it('renders the H1 with an amber <em> on a trailing "Legacy"', () => {
    render(
      <Hero
        name="The Caliente Legacy"
        description={null}
        stats={stats}
        founder={null}
        currentHeir={null}
      />,
    )
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    // The <em> element should hold the word "Legacy"
    const em = heading.querySelector('em')
    expect(em).not.toBeNull()
    expect(em?.textContent).toBe('Legacy')
  })

  it('renders the H1 without <em> when name does not end in "Legacy"', () => {
    render(
      <Hero
        name="The Caliente Chronicle"
        description={null}
        stats={stats}
        founder={null}
        currentHeir={null}
      />,
    )
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.querySelector('em')).toBeNull()
    expect(heading.textContent).toBe('The Caliente Chronicle')
  })

  it('renders all four stat values', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
        founder={null}
        currentHeir={null}
      />,
    )
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()
  })

  it('omits the Now & then card when both founder and heir are null', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
        founder={null}
        currentHeir={null}
      />,
    )
    expect(screen.queryByText('Now & then')).not.toBeInTheDocument()
  })

  it('renders the Now & then card when founder is provided', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
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
        founder={null}
        currentHeir={null}
        treeSlot={<button>View family tree</button>}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'View family tree' }),
    ).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <Hero
        name="Test Legacy"
        description="A great family story."
        stats={stats}
        founder={null}
        currentHeir={null}
      />,
    )
    expect(screen.getByText('A great family story.')).toBeInTheDocument()
  })

  it('omits description paragraph when description is null', () => {
    const { container } = render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
        founder={null}
        currentHeir={null}
      />,
    )
    // Should not have a <p> with blurb class
    const blurbs = container.querySelectorAll('p')
    // The only <p> elements come from Eyebrow — no blurb paragraph
    expect(
      Array.from(blurbs).find((p) => p.textContent === ''),
    ).toBeUndefined()
  })

  it('renders both founder and heir columns with a divider when both are provided', () => {
    render(
      <Hero
        name="Test Legacy"
        description={null}
        stats={stats}
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
