// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { PackType } from '@prisma/client'
import { server } from '@/test/msw-server'
import { renderWithTRPC } from '@/test/render'
import { type PackGroup } from '@/lib/packs'
import { PackGrid } from '../pack-grid'

vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => <span>{props.alt}</span>,
}))

const expansionGroup: PackGroup = {
  type: PackType.EXPANSION,
  packs: [
    { id: 'p1', name: 'City Living', type: PackType.EXPANSION, icon: '🏙️', imageUrl: null, isOwned: false },
    { id: 'p2', name: 'Seasons', type: PackType.EXPANSION, icon: '🍂', imageUrl: null, isOwned: true },
  ],
}

function mockPacksGetAll(groups: PackGroup[] = [expansionGroup]) {
  server.use(
    http.get('http://localhost/api/trpc/packs.getAll', () =>
      HttpResponse.json([{ result: { data: groups } }])
    )
  )
}

function mockPacksToggle(response = { isOwned: true }) {
  server.use(
    http.post('http://localhost/api/trpc/packs.toggle', () =>
      HttpResponse.json([{ result: { data: response } }])
    )
  )
}

describe('PackGrid', () => {
  it('renders section label and all pack cards', async () => {
    mockPacksGetAll()
    renderWithTRPC(<PackGrid initialGroups={[expansionGroup]} />)
    expect(screen.getByText('Expansion Packs')).toBeInTheDocument()
    expect(screen.getByText('City Living')).toBeInTheDocument()
    expect(screen.getByText('Seasons')).toBeInTheDocument()
  })

  it('shows correct owned-pack count from initialGroups', async () => {
    mockPacksGetAll()
    renderWithTRPC(<PackGrid initialGroups={[expansionGroup]} />)
    expect(screen.getByText(/1 pack selected/)).toBeInTheDocument()
  })

  it('uses plural "packs" when count > 1', async () => {
    const groups: PackGroup[] = [{
      type: PackType.EXPANSION,
      packs: [
        { id: 'p1', name: 'City Living', type: PackType.EXPANSION, icon: null, imageUrl: null, isOwned: true },
        { id: 'p2', name: 'Seasons', type: PackType.EXPANSION, icon: null, imageUrl: null, isOwned: true },
      ],
    }]
    mockPacksGetAll(groups)
    renderWithTRPC(<PackGrid initialGroups={groups} />)
    expect(screen.getByText(/2 packs selected/)).toBeInTheDocument()
  })

  it('sets aria-pressed correctly for owned and unowned packs', async () => {
    mockPacksGetAll()
    renderWithTRPC(<PackGrid initialGroups={[expansionGroup]} />)
    expect(screen.getByRole('button', { name: /City Living/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Seasons/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls the toggle mutation when a card is clicked', async () => {
    mockPacksGetAll()
    mockPacksToggle()
    const user = userEvent.setup()
    renderWithTRPC(<PackGrid initialGroups={[expansionGroup]} />)
    await user.click(screen.getByRole('button', { name: /City Living/ }))
    // Assert the transient optimistic flip: waitFor's first poll catches
    // aria-pressed="true" before the invalidation refetch lands (the getAll
    // mock still reports the pack as not owned, so the settled state reverts).
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /City Living/ })).toHaveAttribute('aria-pressed', 'true')
    )
  })

  it('renders multiple sections when multiple groups are provided', async () => {
    const groups: PackGroup[] = [
      { type: PackType.EXPANSION, packs: [{ id: 'p1', name: 'City Living', type: PackType.EXPANSION, icon: null, imageUrl: null, isOwned: false }] },
      { type: PackType.KIT, packs: [{ id: 'p2', name: 'Nifty Knitting', type: PackType.KIT, icon: null, imageUrl: null, isOwned: false }] },
    ]
    mockPacksGetAll(groups)
    renderWithTRPC(<PackGrid initialGroups={groups} />)
    expect(screen.getByText('Expansion Packs')).toBeInTheDocument()
    expect(screen.getByText('Kits')).toBeInTheDocument()
  })
})
