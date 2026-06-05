// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdSim, WorldOption } from '../../../lib/types'

const mutateAsync = vi.fn().mockResolvedValue({ id: 'new-h' })
const refresh = vi.fn()
vi.mock('@/trpc/client', () => ({
  trpc: {
    households: {
      create: { useMutation: () => ({ mutateAsync, isPending: false }) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

import { FoundHouseholdDialog } from '../found-household-dialog'

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

const WORLDS: WorldOption[] = [
  { id: 'w1', name: 'Willow Creek', lots: ['1 Goth Hill', '165 Sim Lane'] },
]

const baseProps = {
  legacyId: 'legacy-1',
  worlds: WORLDS,
  sims: [sim({ id: 's1', firstName: 'Dina', householdId: 'h1' }), sim({ id: 's2', firstName: 'Nina' })],
  homeNames: { h1: 'Goth Manor' } as Record<string, string>,
  onClose: vi.fn(),
  onFounded: vi.fn(),
}

describe('FoundHouseholdDialog', () => {
  beforeEach(() => {
    mutateAsync.mockClear()
    refresh.mockClear()
    baseProps.onFounded.mockClear()
  })

  it('disables founding until a name is entered', async () => {
    const user = userEvent.setup()
    render(<FoundHouseholdDialog {...baseProps} />)

    const submit = screen.getByRole('button', { name: /Found the household/i })
    expect(submit).toBeDisabled()
    await user.type(screen.getByPlaceholderText('Name your household'), 'Zest Bungalow')
    expect(submit).toBeEnabled()
  })

  it('lists every sim with their current home', () => {
    render(<FoundHouseholdDialog {...baseProps} />)
    expect(screen.getByRole('button', { name: /Dina/ })).toHaveAccessibleName(/Goth Manor/)
    expect(screen.getByRole('button', { name: /Nina/ })).toHaveAccessibleName(/Unhoused/)
  })

  it('creates the household with the entered fields and selected sims, then reports the id', async () => {
    const user = userEvent.setup()
    render(<FoundHouseholdDialog {...baseProps} />)

    await user.type(screen.getByPlaceholderText('Name your household'), 'Zest Bungalow')
    // Choosing a world auto-fills its first canonical lot.
    await user.click(screen.getByRole('button', { name: 'World' }))
    await user.click(await screen.findByRole('option', { name: 'Willow Creek' }))
    await user.click(screen.getByRole('button', { name: /Nina/ }))
    await user.click(screen.getByRole('button', { name: /Found the household/i }))

    expect(mutateAsync).toHaveBeenCalledWith({
      legacyId: 'legacy-1',
      name: 'Zest Bungalow',
      worldId: 'w1',
      lot: '1 Goth Hill',
      funds: 20000,
      description: undefined,
      simIds: ['s2'],
    })
    expect(refresh).toHaveBeenCalled()
    expect(baseProps.onFounded).toHaveBeenCalledWith('new-h')
  })

  it('founds without an address when no world is chosen', async () => {
    const user = userEvent.setup()
    render(<FoundHouseholdDialog {...baseProps} />)

    // World starts empty; the lot select is disabled until a world is chosen.
    expect(screen.getByRole('button', { name: 'World' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lot' })).toBeDisabled()

    await user.type(screen.getByPlaceholderText('Name your household'), 'Nomad Camp')
    await user.click(screen.getByRole('button', { name: /Found the household/i }))

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nomad Camp', worldId: undefined, lot: undefined }),
    )
  })

  it('shows an inline error when the mutation fails', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('nope'))
    const user = userEvent.setup()
    render(<FoundHouseholdDialog {...baseProps} />)

    await user.type(screen.getByPlaceholderText('Name your household'), 'X')
    await user.click(screen.getByRole('button', { name: /Found the household/i }))

    expect(await screen.findByText(/Couldn.t found the household/i)).toBeInTheDocument()
    expect(baseProps.onFounded).not.toHaveBeenCalled()
  })
})
