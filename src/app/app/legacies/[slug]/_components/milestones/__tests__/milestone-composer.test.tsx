// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilestoneComposer } from '../milestone-composer'
import type { ChronicleSim, Milestone } from '../../../lib/types'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  })
  class MockResizeObserver { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() }
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})

const { mockCreate, mockUpdate } = vi.hoisted(() => ({
  mockCreate: vi.fn().mockResolvedValue({ id: 'm-new' }),
  mockUpdate: vi.fn().mockResolvedValue({ id: 'm1' }),
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    milestones: {
      create: { useMutation: vi.fn(() => ({ mutateAsync: mockCreate, isPending: false })) },
      update: { useMutation: vi.fn(() => ({ mutateAsync: mockUpdate, isPending: false })) },
    },
  },
}))

const simsById: Record<string, ChronicleSim> = {
  s1: { id: 's1', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 3, lifeStage: 'TEEN', isHeir: true, isFounder: false, aspirationName: null },
}

function base() {
  return { legacyId: 'leg-1', simsById, onDone: vi.fn(), onCancelEdit: vi.fn() }
}

describe('MilestoneComposer (drawer)', () => {
  it('opens the drawer and creates a milestone', async () => {
    render(<MilestoneComposer {...base()} editing={null} />)
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    expect(screen.getByRole('dialog', { name: 'New milestone' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/title/i), 'The feud begins')
    await userEvent.click(screen.getByRole('button', { name: /save milestone/i }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ legacyId: 'leg-1', title: 'The feud begins' }))
  })

  it('disables save when the title is empty', async () => {
    render(<MilestoneComposer {...base()} editing={null} />)
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    expect(screen.getByRole('button', { name: /save milestone/i })).toBeDisabled()
  })

  it('opens pre-filled for editing and calls update', async () => {
    const editing: Milestone = { id: 'm1', kind: 'Note', gen: 3, simIds: ['s1'], title: 'Old title', blurb: 'old', userAuthored: true, sortOrder: 100 }
    render(<MilestoneComposer {...base()} editing={editing} />)
    expect(screen.getByRole('dialog', { name: 'Edit milestone' })).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toHaveValue('Old title')
    await userEvent.click(screen.getByRole('button', { name: /save milestone/i }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', title: 'Old title' })))
  })
})
