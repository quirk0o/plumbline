// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdView, HouseholdSim } from '../../../lib/types'

vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

import { FeaturedHousehold } from '../featured-household'
import { HouseholdCard } from '../household-card'

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

describe('FeaturedHousehold', () => {
  it('renders the now-playing pill, identity, stats, and manage CTA', async () => {
    const user = userEvent.setup()
    const onManage = vi.fn()
    render(
      <FeaturedHousehold
        household={household({
          id: 'h1',
          name: 'Caliente Villa',
          isActive: true,
          funds: 184250,
          lotValue: 248900,
          worldName: 'Willow Creek',
          lot: '165 Sim Lane',
          description: 'The seat of the legacy.',
          foundedGeneration: 1,
          residents: [sim({ id: 's1', firstName: 'Dina', householdId: 'h1' })],
        })}
        onManage={onManage}
      />,
    )

    expect(screen.getByText('Now playing')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Caliente Villa' })).toBeInTheDocument()
    expect(screen.getByText('Willow Creek · 165 Sim Lane')).toBeInTheDocument()
    expect(screen.getByText('§184,250')).toBeInTheDocument()
    expect(screen.getByText('§248,900')).toBeInTheDocument()
    expect(screen.getByText('Gen I')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Manage household/i }))
    expect(onManage).toHaveBeenCalled()
  })

  it('omits the Founded stat when foundedGeneration is null', () => {
    render(
      <FeaturedHousehold
        household={household({ id: 'h1', name: 'Old House', foundedGeneration: null })}
        onManage={vi.fn()}
      />,
    )
    expect(screen.queryByText('Founded')).not.toBeInTheDocument()
  })
})

describe('HouseholdCard', () => {
  it('renders name, address, funds, resident count, and opens on click', async () => {
    const user = userEvent.setup()
    const onManage = vi.fn()
    render(
      <HouseholdCard
        household={household({
          id: 'h2',
          name: 'Goth Manor',
          worldName: 'Willow Creek',
          lot: '1 Goth Hill',
          funds: 92400,
          residents: [sim({ id: 's2', firstName: 'Mortimer', householdId: 'h2' })],
        })}
        onManage={onManage}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Goth Manor' })).toBeInTheDocument()
    expect(screen.getByText('Willow Creek · 1 Goth Hill')).toBeInTheDocument()
    expect(screen.getByText('§92,400')).toBeInTheDocument()
    expect(screen.getByText('· 1 resident')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Goth Manor/ }))
    expect(onManage).toHaveBeenCalled()
  })

  it('notes an empty lot when there are no residents', () => {
    render(
      <HouseholdCard household={household({ id: 'h3', name: 'Fresh Lot' })} onManage={vi.fn()} />,
    )
    expect(screen.getByText('Empty lot')).toBeInTheDocument()
  })

  it('activates with the keyboard', async () => {
    const user = userEvent.setup()
    const onManage = vi.fn()
    render(
      <HouseholdCard household={household({ id: 'h2', name: 'Goth Manor' })} onManage={onManage} />,
    )

    await user.tab()
    expect(screen.getByRole('button', { name: /Goth Manor/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onManage).toHaveBeenCalledTimes(2)
  })
})
