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
    render(<MilestoneRow milestone={derivedMilestone} simsById={simsById} />)
    expect(screen.getByTestId('plumbob')).toBeInTheDocument()
  })

  it('does not render the amber circle for a derived row', () => {
    const { container } = render(
      <MilestoneRow milestone={derivedMilestone} simsById={simsById} />,
    )
    // The authored marker is a <span> without testid; check by absence of its border style
    const spans = container.querySelectorAll('span')
    const hasAuthoredMarker = Array.from(spans).some(
      (s) => s.style.border && s.style.border.includes('amber'),
    )
    expect(hasAuthoredMarker).toBe(false)
  })

  it('renders the milestone title', () => {
    render(<MilestoneRow milestone={derivedMilestone} simsById={simsById} />)
    expect(
      screen.getByText('Dina arrives in Willow Creek'),
    ).toBeInTheDocument()
  })

  it('renders the blurb when provided', () => {
    render(<MilestoneRow milestone={derivedMilestone} simsById={simsById} />)
    expect(screen.getByText('The legacy begins.')).toBeInTheDocument()
  })

  it('hides the blurb line when blurb is null', () => {
    const noBlurb: Milestone = { ...derivedMilestone, blurb: null }
    render(<MilestoneRow milestone={noBlurb} simsById={simsById} />)
    expect(screen.queryByText('The legacy begins.')).not.toBeInTheDocument()
  })

  it('renders only resolvable avatars — skips ids not in simsById', () => {
    const withUnknown: Milestone = {
      ...derivedMilestone,
      simIds: ['dina', 'unknown-sim'],
    }
    render(<MilestoneRow milestone={withUnknown} simsById={simsById} />)
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
    render(<MilestoneRow milestone={twoSims} simsById={simsById} />)
    expect(screen.getByText('DC')).toBeInTheDocument()
    expect(screen.getByText('RC')).toBeInTheDocument()
  })

  it('renders the generation label when gen is non-null', () => {
    render(<MilestoneRow milestone={derivedMilestone} simsById={simsById} />)
    expect(screen.getByText('Gen I')).toBeInTheDocument()
  })

  it('omits the generation label when gen is null', () => {
    const noGen: Milestone = { ...derivedMilestone, gen: null }
    render(<MilestoneRow milestone={noGen} simsById={simsById} />)
    expect(screen.queryByText(/Gen /)).not.toBeInTheDocument()
  })
})
