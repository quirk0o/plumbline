// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PackType } from '@prisma/client'
import { PackGrid } from '../pack-grid'

const mockMutate = vi.fn()
const mockSetData = vi.fn()
const mockInvalidate = vi.fn()

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    packs: {
      getAll: {
        useQuery: vi.fn((_input: unknown, opts: { initialData: unknown }) => ({
          data: opts?.initialData,
        })),
      },
      toggle: {
        useMutation: vi.fn(() => ({ mutate: mockMutate })),
      },
    },
    useUtils: vi.fn(() => ({
      packs: {
        getAll: {
          cancel: vi.fn(),
          getData: vi.fn(),
          setData: mockSetData,
          invalidate: mockInvalidate,
        },
      },
    })),
  },
}))

const expansionGroup = {
  type: PackType.EXPANSION,
  packs: [
    { id: 'p1', name: 'City Living', type: PackType.EXPANSION, icon: '🏙️', imageUrl: null, isOwned: false },
    { id: 'p2', name: 'Seasons', type: PackType.EXPANSION, icon: '🍂', imageUrl: null, isOwned: true },
  ],
}

beforeEach(() => vi.clearAllMocks())

describe('PackGrid', () => {
  it('renders section label and all pack cards', () => {
    render(<PackGrid initialGroups={[expansionGroup]} />)
    expect(screen.getByText('Expansion Packs')).toBeInTheDocument()
    expect(screen.getByText('City Living')).toBeInTheDocument()
    expect(screen.getByText('Seasons')).toBeInTheDocument()
  })

  it('shows correct owned-pack count', () => {
    render(<PackGrid initialGroups={[expansionGroup]} />)
    expect(screen.getByText(/1 pack selected/)).toBeInTheDocument()
  })

  it('uses plural "packs" when count is 0 or > 1', () => {
    const groups = [{
      type: PackType.EXPANSION,
      packs: [
        { id: 'p1', name: 'City Living', type: PackType.EXPANSION, icon: null, imageUrl: null, isOwned: true },
        { id: 'p2', name: 'Seasons', type: PackType.EXPANSION, icon: null, imageUrl: null, isOwned: true },
      ],
    }]
    render(<PackGrid initialGroups={groups} />)
    expect(screen.getByText(/2 packs selected/)).toBeInTheDocument()
  })

  it('sets aria-pressed correctly for owned and unowned packs', () => {
    render(<PackGrid initialGroups={[expansionGroup]} />)
    expect(screen.getByRole('button', { name: /City Living/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Seasons/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls the toggle mutation with packId when a card is clicked', () => {
    render(<PackGrid initialGroups={[expansionGroup]} />)
    fireEvent.click(screen.getByRole('button', { name: /City Living/ }))
    expect(mockMutate).toHaveBeenCalledOnce()
    expect(mockMutate).toHaveBeenCalledWith({ packId: 'p1' })
  })

  it('renders multiple sections when multiple groups are provided', () => {
    const groups = [
      { type: PackType.EXPANSION, packs: [{ id: 'p1', name: 'City Living', type: PackType.EXPANSION, icon: null, imageUrl: null, isOwned: false }] },
      { type: PackType.KIT, packs: [{ id: 'p2', name: 'Nifty Knitting', type: PackType.KIT, icon: null, imageUrl: null, isOwned: false }] },
    ]
    render(<PackGrid initialGroups={groups} />)
    expect(screen.getByText('Expansion Packs')).toBeInTheDocument()
    expect(screen.getByText('Kits')).toBeInTheDocument()
  })
})
