// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilestonesClient, neighborSortOrders } from '../milestones-client'
import type { Milestone, ChronicleSim } from '../../../lib/types'

const { mockDelete, mockRefresh } = vi.hoisted(() => ({
  mockDelete: vi.fn().mockResolvedValue({ id: 'm1' }),
  mockRefresh: vi.fn(),
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    milestones: {
      create: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      update: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      delete: { useMutation: vi.fn(() => ({ mutateAsync: mockDelete, isPending: false })) },
      reorder: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mockRefresh }) }))

const simsById: Record<string, ChronicleSim> = {
  s1: { id: 's1', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 3, lifeStage: 'TEEN', isHeir: true, isFounder: false, aspirationName: null },
}

const milestones: Milestone[] = [
  { id: 'birth-s1', kind: 'Birth', gen: 3, simIds: ['s1'], title: 'Reed Caliente is born', blurb: null, userAuthored: false, sortOrder: 200 },
  { id: 'm1', kind: 'Note', gen: 3, simIds: ['s1'], title: 'On the back porch', blurb: 'Kind to each other tonight.', userAuthored: true, sortOrder: 100 },
]

describe('MilestonesClient', () => {
  beforeEach(() => {
    mockDelete.mockClear()
    mockRefresh.mockClear()
  })

  it('renders auto and user rows', () => {
    render(<MilestonesClient milestones={milestones} simsById={simsById} slug="goth" legacyId="leg-1" />)
    expect(screen.getByText('Reed Caliente is born')).toBeInTheDocument()
    expect(screen.getByText('On the back porch')).toBeInTheDocument()
  })

  it('shows the composer trigger', () => {
    render(<MilestonesClient milestones={[]} simsById={{}} slug="goth" legacyId="leg-1" />)
    expect(screen.getByRole('button', { name: /add milestone/i })).toBeInTheDocument()
  })

  it('renders Edit/Delete controls for user rows but not auto rows', () => {
    render(<MilestonesClient milestones={milestones} simsById={simsById} slug="goth" legacyId="leg-1" />)
    // User-authored note has Edit + Delete.
    expect(screen.getByRole('button', { name: /Edit On the back porch/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete On the back porch/i })).toBeInTheDocument()
    // Auto (Birth) row has neither.
    expect(screen.queryByRole('button', { name: /Edit Reed Caliente is born/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Delete Reed Caliente is born/i })).toBeNull()
  })

  it('clicking Delete calls milestones.delete and removes the row', async () => {
    render(<MilestonesClient milestones={milestones} simsById={simsById} slug="goth" legacyId="leg-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Delete On the back porch/i }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith({ id: 'm1' }))
    // Optimistically removed from the list.
    await waitFor(() => expect(screen.queryByText('On the back porch')).toBeNull())
    // The auto row remains.
    expect(screen.getByText('Reed Caliente is born')).toBeInTheDocument()
  })

  it('clicking Edit opens the composer pre-filled with the row', async () => {
    render(<MilestonesClient milestones={milestones} simsById={simsById} slug="goth" legacyId="leg-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Edit On the back porch/i }))

    const titleInput = (await screen.findByLabelText(/title/i)) as HTMLInputElement
    const storyInput = screen.getByLabelText(/story/i) as HTMLTextAreaElement
    expect(titleInput.value).toBe('On the back porch')
    expect(storyInput.value).toBe('Kind to each other tonight.')
    // The Save (update) button is present in edit mode.
    expect(screen.getByRole('button', { name: /save milestone/i })).toBeInTheDocument()
  })
})

describe('neighborSortOrders', () => {
  // Newest-first list: prev = row above (higher sortOrder), next = below (lower).
  const items: Milestone[] = [
    { id: 'a', kind: 'Note', gen: null, simIds: [], title: 'A', blurb: null, userAuthored: true, sortOrder: 300 },
    { id: 'b', kind: 'Note', gen: null, simIds: [], title: 'B', blurb: null, userAuthored: true, sortOrder: 200 },
    { id: 'c', kind: 'Note', gen: null, simIds: [], title: 'C', blurb: null, userAuthored: true, sortOrder: 100 },
  ]

  it('returns the higher (above) and lower (below) neighbor sortOrders for a middle row', () => {
    expect(neighborSortOrders(items, 1)).toEqual({ prevSortOrder: 300, nextSortOrder: 100 })
  })

  it('returns undefined prev at the top of the list', () => {
    expect(neighborSortOrders(items, 0)).toEqual({ prevSortOrder: undefined, nextSortOrder: 200 })
  })

  it('returns undefined next at the bottom of the list', () => {
    expect(neighborSortOrders(items, 2)).toEqual({ prevSortOrder: 200, nextSortOrder: undefined })
  })
})
