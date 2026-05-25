// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Roster } from '../roster/roster'
import type { RosterGroup } from '../../lib/types'

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

const groups: RosterGroup[] = [
  {
    gen: 1,
    sims: [
      {
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
    ],
  },
  {
    gen: 2,
    sims: [
      {
        id: 'alex',
        firstName: 'Alex',
        lastName: 'Goth',
        imageUrl: null,
        generationNumber: 2,
        lifeStage: 'YOUNG_ADULT',
        isHeir: true,
        isFounder: false,
        aspirationName: null,
      },
    ],
  },
]

const nullGenGroup: RosterGroup = {
  gen: null,
  sims: [
    {
      id: 'orphan',
      firstName: 'Orphan',
      lastName: 'Sim',
      imageUrl: null,
      generationNumber: null,
      lifeStage: 'CHILD',
      isHeir: false,
      isFounder: false,
      aspirationName: null,
    },
  ],
}

describe('Roster', () => {
  it('renders the "Add sim" link with the correct href', () => {
    render(<Roster groups={groups} slug="caliente" />)
    const addLink = screen.getByRole('link', { name: 'Add sim' })
    expect(addLink).toHaveAttribute(
      'href',
      '/app/legacies/caliente/sims/new',
    )
  })

  it('renders a GenerationBadge per group', () => {
    render(<Roster groups={groups} slug="caliente" />)
    expect(screen.getByText('Gen I')).toBeInTheDocument()
    expect(screen.getByText('Gen II')).toBeInTheDocument()
  })

  it('renders "Unassigned" badge for a null-gen group', () => {
    render(<Roster groups={[nullGenGroup]} slug="caliente" />)
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('renders the section heading', () => {
    render(<Roster groups={[]} slug="caliente" />)
    expect(
      screen.getByRole('heading', { name: 'All sims' }),
    ).toBeInTheDocument()
  })

  it('renders each sim card with correct link href', () => {
    render(<Roster groups={groups} slug="caliente" />)
    const dinaLink = screen.getByRole('link', { name: /Dina Caliente/ })
    expect(dinaLink).toHaveAttribute(
      'href',
      '/app/legacies/caliente/sims/dina',
    )
  })

  it('renders sim count labels for each group', () => {
    render(<Roster groups={groups} slug="caliente" />)
    // Each group has 1 sim
    const countLabels = screen.getAllByText('1 sim')
    expect(countLabels).toHaveLength(2)
  })

  it('renders "sims" (plural) for groups with multiple sims', () => {
    const multiGroup: RosterGroup[] = [
      {
        gen: 1,
        sims: [
          {
            id: 'a',
            firstName: 'A',
            lastName: 'B',
            imageUrl: null,
            generationNumber: 1,
            lifeStage: 'ADULT',
            isHeir: false,
            isFounder: false,
            aspirationName: null,
          },
          {
            id: 'c',
            firstName: 'C',
            lastName: 'D',
            imageUrl: null,
            generationNumber: 1,
            lifeStage: 'ADULT',
            isHeir: false,
            isFounder: false,
            aspirationName: null,
          },
        ],
      },
    ]
    render(<Roster groups={multiGroup} slug="caliente" />)
    expect(screen.getByText('2 sims')).toBeInTheDocument()
  })

  it('shows Founder in the meta line for the founder sim', () => {
    render(<Roster groups={groups} slug="caliente" />)
    expect(screen.getByText(/Founder/)).toBeInTheDocument()
  })

  it('shows Heir in the meta line for an heir sim', () => {
    render(<Roster groups={groups} slug="caliente" />)
    expect(screen.getByText(/Heir/)).toBeInTheDocument()
  })
})
