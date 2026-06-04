// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
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

describe('MilestoneComposer (drawer)', () => {
  beforeEach(() => {
    mockCreate.mockClear()
    mockUpdate.mockClear()
  })

  it('opens the drawer and creates a milestone (chips drive the payload, then onDone fires)', async () => {
    const onDone = vi.fn()
    render(<MilestoneComposer legacyId="leg-1" simsById={simsById} editing={null} onDone={onDone} onCancelEdit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    expect(screen.getByRole('dialog', { name: 'New milestone' })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText(/title/i), 'The feud begins')
    // Tagging a sim via the chip should flow into the mutation payload.
    await userEvent.click(screen.getByRole('button', { name: /Reed/ }))
    await userEvent.click(screen.getByRole('button', { name: /save milestone/i }))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ legacyId: 'leg-1', title: 'The feud begins', simIds: ['s1'] }),
    )
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('disables save when the title is empty', async () => {
    render(<MilestoneComposer legacyId="leg-1" simsById={simsById} editing={null} onDone={vi.fn()} onCancelEdit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    expect(screen.getByRole('button', { name: /save milestone/i })).toBeDisabled()
  })

  it('opens pre-filled for editing, calls update, then onDone fires', async () => {
    const onDone = vi.fn()
    const editing: Milestone = { id: 'm1', kind: 'Note', gen: 3, simIds: ['s1'], title: 'Old title', blurb: 'old', userAuthored: true, sortOrder: 100 }
    render(<MilestoneComposer legacyId="leg-1" simsById={simsById} editing={editing} onDone={onDone} onCancelEdit={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Edit milestone' })).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toHaveValue('Old title')
    await userEvent.click(screen.getByRole('button', { name: /save milestone/i }))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1', title: 'Old title' })))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })
})
