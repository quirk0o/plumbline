// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdView, HouseholdSim, WorldOption } from '../../../lib/types'

const mutations = {
  create: vi.fn().mockResolvedValue({ id: 'new-h' }),
  update: vi.fn().mockResolvedValue({}),
  setActive: vi.fn().mockResolvedValue({}),
  moveSim: vi.fn().mockResolvedValue({}),
}
vi.mock('@/trpc/client', () => ({
  trpc: {
    households: {
      create: { useMutation: () => ({ mutateAsync: mutations.create, isPending: false }) },
      update: { useMutation: () => ({ mutateAsync: mutations.update, isPending: false }) },
      setActive: { useMutation: () => ({ mutateAsync: mutations.setActive, isPending: false }) },
      moveSim: { useMutation: () => ({ mutateAsync: mutations.moveSim, isPending: false }) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

import { HouseholdsSection } from '../households-section'

function sim(over: Partial<HouseholdSim> & { id: string; firstName: string }): HouseholdSim {
  return {
    lastName: 'Caliente',
    imageUrl: null,
    isHeir: false,
    isFounder: false,
    generationNumber: 1,
    lifeStage: 'YOUNG_ADULT',
    householdId: null,
    ...over,
  }
}

function household(over: Partial<HouseholdView> & { id: string; name: string }): HouseholdView {
  return {
    worldId: null,
    worldName: null,
    lot: null,
    description: null,
    funds: 0,
    lotValue: 0,
    foundedGeneration: 1,
    isActive: false,
    residents: [],
    ...over,
  }
}

const WORLDS: WorldOption[] = [{ id: 'w1', name: 'Willow Creek', lots: ['1 Goth Hill'] }]

const baseProps = {
  legacyId: 'legacy-1',
  worlds: WORLDS,
  sims: [] as HouseholdSim[],
}

describe('HouseholdsSection', () => {
  it('renders the featured card for the active household and compact cards for the rest', () => {
    const dina = sim({ id: 's1', firstName: 'Dina', householdId: 'h1' })
    render(
      <HouseholdsSection
        {...baseProps}
        sims={[dina]}
        households={[
          household({
            id: 'h1',
            name: 'Caliente Villa',
            isActive: true,
            funds: 184250,
            worldName: 'Willow Creek',
            lot: '165 Sim Lane',
            description: 'The seat of the legacy.',
            residents: [dina],
          }),
          household({ id: 'h2', name: 'Goth Manor', funds: 92400 }),
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Households' })).toBeInTheDocument()
    expect(screen.getByText('Now playing')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Caliente Villa' })).toBeInTheDocument()
    expect(screen.getByText('§184,250')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Goth Manor' })).toBeInTheDocument()
    expect(screen.getByText('Empty lot')).toBeInTheDocument()
  })

  it('renders every household in the grid when none is active', () => {
    render(
      <HouseholdsSection
        {...baseProps}
        households={[
          household({ id: 'h1', name: 'Goth Manor' }),
          household({ id: 'h2', name: 'Zest Bungalow' }),
        ]}
      />,
    )
    expect(screen.queryByText('Now playing')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Goth Manor' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Zest Bungalow' })).toBeInTheDocument()
  })

  it('shows the empty state with a founding CTA and hides the header button', () => {
    render(<HouseholdsSection {...baseProps} households={[]} />)
    expect(screen.getByText('No households yet')).toBeInTheDocument()
    const foundButtons = screen.getAllByRole('button', { name: /Found a household/i })
    expect(foundButtons).toHaveLength(1) // only the CTA, no header button
  })

  it('opens the founding dialog from the header button', async () => {
    const user = userEvent.setup()
    render(
      <HouseholdsSection {...baseProps} households={[household({ id: 'h1', name: 'Goth Manor' })]} />,
    )
    await user.click(screen.getByRole('button', { name: /Found a household/i }))
    expect(screen.getByPlaceholderText('Name your household')).toBeInTheDocument()
  })

  it('opens the management drawer from a compact card', async () => {
    const user = userEvent.setup()
    render(
      <HouseholdsSection {...baseProps} households={[household({ id: 'h1', name: 'Goth Manor' })]} />,
    )
    await user.click(screen.getByRole('button', { name: /Goth Manor/ }))
    expect(screen.getByRole('button', { name: 'Set as active' })).toBeInTheDocument()
  })
})
