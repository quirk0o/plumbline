// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ChronicleSections } from '../chronicle-sections/chronicle-sections'
import type {
  ChronicleSim,
  Milestone,
  RosterGroup,
  SuccessionStep,
} from '../../lib/types'

vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => (
    <span data-testid="portrait-image" aria-label={alt} />
  ),
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    milestones: {
      create: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      update: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      delete: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      reorder: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
    },
  },
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

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

const dina: ChronicleSim = {
  id: 'dina',
  firstName: 'Dina',
  lastName: 'Caliente',
  imageUrl: null,
  generationNumber: 1,
  lifeStage: 'ADULT',
  isHeir: false,
  isFounder: true,
  aspirationName: 'Fabulously Wealthy',
}

const reed: ChronicleSim = {
  id: 'reed',
  firstName: 'Reed',
  lastName: 'Caliente',
  imageUrl: null,
  generationNumber: 3,
  lifeStage: 'TEEN',
  isHeir: true,
  isFounder: false,
  aspirationName: null,
}

const succession: SuccessionStep[] = [
  { sim: dina, role: 'Founder', isHeir: false, isFounder: true },
  { sim: reed, role: 'Heir designate', isHeir: true, isFounder: false },
]

const milestones: Milestone[] = [
  {
    id: 'birth-dina',
    kind: 'Founding',
    gen: 1,
    simIds: ['dina'],
    title: 'Dina Caliente founds the legacy',
    blurb: null,
    userAuthored: false,
    sortOrder: 1000,
  },
]

const groups: RosterGroup[] = [
  { gen: 1, sims: [dina] },
  { gen: 3, sims: [reed] },
]

const simsById: Record<string, ChronicleSim> = { dina, reed }

const baseProps = {
  name: 'The Caliente Legacy',
  description: 'Three sisters, twelve generations.',
  slug: 'caliente',
  legacyId: 'leg-caliente',
  stats: { sims: 2, generations: 2, households: 1, milestones: 1 },
  founder: dina,
  currentHeir: reed,
  succession,
  milestones,
  simsById,
  groups,
  treeSlot: <button type="button">View family tree</button>,
}

describe('ChronicleSections', () => {
  it('renders all four sections as anchor targets', () => {
    render(<ChronicleSections {...baseProps} />)
    // SectionNav locates sections via id — assert each section carries the correct id.
    expect(screen.getByTestId('section-hero')).toHaveAttribute('id', 'hero')
    expect(screen.getByTestId('section-succession')).toHaveAttribute('id', 'succession')
    expect(screen.getByTestId('section-milestones')).toHaveAttribute('id', 'milestones')
    expect(screen.getByTestId('roster')).toHaveAttribute('id', 'sims')
  })

  it('renders the section content (headings + milestone)', () => {
    render(<ChronicleSections {...baseProps} />)
    expect(
      screen.getByRole('heading', { name: /succession line/i, level: 2 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /milestones/i, level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /all sims/i, level: 2 })).toBeInTheDocument()
    expect(
      screen.getByText(/Dina Caliente founds the legacy/i),
    ).toBeInTheDocument()
  })

  it('renders the treeSlot content inside the hero', () => {
    render(<ChronicleSections {...baseProps} />)
    const heroSection = screen.getByTestId('section-hero')
    expect(
      within(heroSection).getByRole('button', { name: /view family tree/i }),
    ).toBeInTheDocument()
  })
})
