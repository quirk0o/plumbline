// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MilestoneRow } from '../milestones/milestone-row'
import type { Milestone, ChronicleSim } from '../../lib/types'

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

// Mock Plumbob so we can assert its presence by a testid without
// needing to render the real CSS-triangle component in jsdom.
vi.mock('@/components/plumbob', () => ({
  Plumbob: ({ size }: { size?: number }) => (
    <span data-testid="plumbob" data-size={size} aria-hidden="true" />
  ),
}))

const simDina: ChronicleSim = {
  id: 'dina',
  firstName: 'Dina',
  lastName: 'Caliente',
  imageUrl: null,
  generationNumber: 1,
  lifeStage: 'ADULT',
  isHeir: false,
  isFounder: true,
  aspirationName: null,
}

const simReed: ChronicleSim = {
  id: 'reed',
  firstName: 'Reed',
  lastName: 'Caliente',
  imageUrl: null,
  generationNumber: 3,
  lifeStage: 'YOUNG_ADULT',
  isHeir: true,
  isFounder: false,
  aspirationName: null,
}

const simsById: Record<string, ChronicleSim> = {
  dina: simDina,
  reed: simReed,
}

const derivedMilestone: Milestone = {
  id: 'birth-dina',
  kind: 'Birth',
  gen: 1,
  simIds: ['dina'],
  title: 'Dina arrives in Willow Creek',
  blurb: 'The legacy begins.',
  userAuthored: false,
}

describe('MilestoneRow', () => {
  it('renders a Plumbob marker for a derived (userAuthored: false) row', () => {
    render(<MilestoneRow milestone={derivedMilestone} simsById={simsById} slug="caliente" />)
    expect(screen.getByTestId('plumbob')).toBeInTheDocument()
  })

  it('does not render the authored marker for a derived row', () => {
    render(<MilestoneRow milestone={derivedMilestone} simsById={simsById} slug="caliente" />)
    expect(
      screen.queryByTestId('milestone-authored-marker'),
    ).not.toBeInTheDocument()
  })

  it('renders the milestone title', () => {
    render(<MilestoneRow milestone={derivedMilestone} simsById={simsById} slug="caliente" />)
    expect(
      screen.getByText('Dina arrives in Willow Creek'),
    ).toBeInTheDocument()
  })

  it('renders the blurb when provided', () => {
    render(<MilestoneRow milestone={derivedMilestone} simsById={simsById} slug="caliente" />)
    expect(screen.getByText('The legacy begins.')).toBeInTheDocument()
  })

  it('hides the blurb line when blurb is null', () => {
    const noBlurb: Milestone = { ...derivedMilestone, blurb: null }
    render(<MilestoneRow milestone={noBlurb} simsById={simsById} slug="caliente" />)
    expect(screen.queryByText('The legacy begins.')).not.toBeInTheDocument()
  })

  it('renders only resolvable avatars — skips ids not in simsById', () => {
    const withUnknown: Milestone = {
      ...derivedMilestone,
      simIds: ['dina', 'unknown-sim'],
    }
    render(<MilestoneRow milestone={withUnknown} simsById={simsById} slug="caliente" />)
    // Only Dina's avatar should appear; unknown-sim has no portrait
    // imageUrl is null → monogram rendered instead
    const initials = screen.queryAllByText('DC')
    expect(initials).toHaveLength(1)
  })

  it('renders avatars for all resolvable simIds', () => {
    const twoSims: Milestone = {
      ...derivedMilestone,
      id: 'marriage-dina-reed',
      kind: 'Marriage',
      simIds: ['dina', 'reed'],
    }
    render(<MilestoneRow milestone={twoSims} simsById={simsById} slug="caliente" />)
    expect(screen.getByText('DC')).toBeInTheDocument()
    expect(screen.getByText('RC')).toBeInTheDocument()
  })

  it('renders the generation label when gen is non-null', () => {
    render(<MilestoneRow milestone={derivedMilestone} simsById={simsById} slug="caliente" />)
    expect(screen.getByText('Gen I')).toBeInTheDocument()
  })

  it('omits the generation label when gen is null', () => {
    const noGen: Milestone = { ...derivedMilestone, gen: null }
    render(<MilestoneRow milestone={noGen} simsById={simsById} slug="caliente" />)
    expect(screen.queryByText(/Gen /)).not.toBeInTheDocument()
  })
})
