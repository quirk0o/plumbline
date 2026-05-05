// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { renderWithTRPC } from '@/test/render'
import { PackGrid } from '../pack-grid'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

const expansionGroup = {
  type: 'EXPANSION',
  packs: [
    { id: 'p1', name: 'City Living', type: 'EXPANSION', icon: '🏙️', imageUrl: null, isOwned: false },
    { id: 'p2', name: 'Seasons', type: 'EXPANSION', icon: '🍂', imageUrl: null, isOwned: true },
  ],
}

function mockPacksGetAll(groups = [expansionGroup]) {
  server.use(
    http.get('http://localhost/api/trpc/packs.getAll', () =>
      HttpResponse.json([{ result: { data: { json: groups } } }])
    )
  )
}

function mockPacksToggle(response = { isOwned: true }) {
  server.use(
    http.post('http://localhost/api/trpc/packs.toggle', () =>
      HttpResponse.json([{ result: { data: { json: response } } }])
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
    const groups = [{
      type: 'EXPANSION',
      packs: [
        { id: 'p1', name: 'City Living', type: 'EXPANSION', icon: null, imageUrl: null, isOwned: true },
        { id: 'p2', name: 'Seasons', type: 'EXPANSION', icon: null, imageUrl: null, isOwned: true },
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
    renderWithTRPC(<PackGrid initialGroups={[expansionGroup]} />)
    fireEvent.click(screen.getByRole('button', { name: /City Living/ }))
    // Optimistic update should flip the state immediately
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /City Living/ })).toHaveAttribute('aria-pressed', 'true')
    )
  })

  it('renders multiple sections when multiple groups are provided', async () => {
    const groups = [
      { type: 'EXPANSION', packs: [{ id: 'p1', name: 'City Living', type: 'EXPANSION', icon: null, imageUrl: null, isOwned: false }] },
      { type: 'KIT', packs: [{ id: 'p2', name: 'Nifty Knitting', type: 'KIT', icon: null, imageUrl: null, isOwned: false }] },
    ]
    mockPacksGetAll(groups)
    renderWithTRPC(<PackGrid initialGroups={groups} />)
    expect(screen.getByText('Expansion Packs')).toBeInTheDocument()
    expect(screen.getByText('Kits')).toBeInTheDocument()
  })
})
