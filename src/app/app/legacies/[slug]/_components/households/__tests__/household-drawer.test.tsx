// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdView, HouseholdSim, WorldOption } from '../../../lib/types'

const mutations = {
  update: vi.fn().mockResolvedValue({}),
  setActive: vi.fn().mockResolvedValue({}),
  moveSim: vi.fn().mockResolvedValue({}),
}
const refresh = vi.fn()
vi.mock('@/trpc/client', () => ({
  trpc: {
    households: {
      update: { useMutation: () => ({ mutateAsync: mutations.update, isPending: false }) },
      setActive: { useMutation: () => ({ mutateAsync: mutations.setActive, isPending: false }) },
      moveSim: { useMutation: () => ({ mutateAsync: mutations.moveSim, isPending: false }) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

import { HouseholdDrawer } from '../household-drawer'

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

const WORLDS: WorldOption[] = [
  { id: 'w1', name: 'Willow Creek', lots: ['1 Goth Hill', '165 Sim Lane'] },
]

const dina = sim({ id: 's1', firstName: 'Dina', householdId: 'h1', isHeir: true })
const nina = sim({ id: 's2', firstName: 'Nina', householdId: 'h2' })

const h1 = household({
  id: 'h1',
  name: 'Caliente Villa',
  isActive: true,
  funds: 184250,
  lotValue: 248900,
  residents: [dina],
})
const h2 = household({ id: 'h2', name: 'Goth Manor', residents: [nina] })

const baseProps = {
  worlds: WORLDS,
  households: [h1, h2],
  sims: [dina, nina],
  autoRename: false,
  onClose: vi.fn(),
}

describe('HouseholdDrawer', () => {
  beforeEach(() => {
    mutations.update.mockClear()
    mutations.setActive.mockClear()
    mutations.moveSim.mockClear()
    refresh.mockClear()
  })

  it('shows Now playing for the active household and Set as active for others', () => {
    const { rerender } = render(<HouseholdDrawer {...baseProps} household={h1} />)
    expect(screen.getByText('Now playing')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Set as active' })).not.toBeInTheDocument()

    rerender(<HouseholdDrawer {...baseProps} household={h2} />)
    expect(screen.queryByText('Now playing')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set as active' })).toBeInTheDocument()
  })

  it('sets the household active and refreshes', async () => {
    const user = userEvent.setup()
    render(<HouseholdDrawer {...baseProps} household={h2} />)
    await user.click(screen.getByRole('button', { name: 'Set as active' }))
    expect(mutations.setActive).toHaveBeenCalledWith({ householdId: 'h2' })
    expect(refresh).toHaveBeenCalled()
  })

  it('commits a rename through households.update', async () => {
    const user = userEvent.setup()
    render(<HouseholdDrawer {...baseProps} household={h1} />)
    await user.click(screen.getByRole('button', { name: 'Caliente Villa' }))
    const input = screen.getByRole('textbox', { name: 'Household name' })
    await user.clear(input)
    await user.type(input, 'Villa Nueva{Enter}')
    expect(mutations.update).toHaveBeenCalledWith({ householdId: 'h1', name: 'Villa Nueva' })
    expect(refresh).toHaveBeenCalled()
  })

  it('renders residents with derived badges and a Move to… select', async () => {
    const user = userEvent.setup()
    render(<HouseholdDrawer {...baseProps} household={h1} />)
    expect(screen.getByText('Dina Caliente')).toBeInTheDocument()
    expect(screen.getByText('Heir')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Move Dina to' }))
    await user.click(await screen.findByRole('option', { name: /Goth Manor/i }))
    expect(mutations.moveSim).toHaveBeenCalledWith({ simId: 's1', toHouseholdId: 'h2' })
  })

  it('moves a resident out to unhoused', async () => {
    const user = userEvent.setup()
    render(<HouseholdDrawer {...baseProps} household={h1} />)
    await user.click(screen.getByRole('button', { name: 'Move Dina to' }))
    await user.click(await screen.findByRole('option', { name: /Unhoused/i }))
    expect(mutations.moveSim).toHaveBeenCalledWith({ simId: 's1', toHouseholdId: null })
  })

  it('moves a sim in from another household via the ghost add row', async () => {
    const user = userEvent.setup()
    render(<HouseholdDrawer {...baseProps} household={h1} />)
    await user.click(screen.getByRole('button', { name: /Move a sim in/i }))
    await user.click(await screen.findByRole('option', { name: /Nina Caliente/i }))
    expect(mutations.moveSim).toHaveBeenCalledWith({ simId: 's2', toHouseholdId: 'h1' })
  })

  it('shows the empty-lot prompt when there are no residents', () => {
    render(
      <HouseholdDrawer
        {...baseProps}
        household={household({ id: 'h3', name: 'Fresh Lot' })}
      />,
    )
    expect(screen.getByText(/This lot is empty/i)).toBeInTheDocument()
  })

  it('notes when every sim already lives here', async () => {
    const user = userEvent.setup()
    render(
      <HouseholdDrawer
        {...baseProps}
        household={h1}
        households={[h1]}
        sims={[dina]}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Move a sim in/i }))
    expect(await screen.findByText('Every sim already lives here.')).toBeInTheDocument()
  })
})
