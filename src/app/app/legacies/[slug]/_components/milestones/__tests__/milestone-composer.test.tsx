// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilestoneComposer } from '../milestone-composer'
import type { ChronicleSim, Milestone } from '../../../lib/types'

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

describe('MilestoneComposer', () => {
  beforeEach(() => {
    mockCreate.mockClear()
    mockUpdate.mockClear()
  })

  it('creates a milestone with the entered title', async () => {
    const onDone = vi.fn()
    render(
      <MilestoneComposer legacyId="leg-1" simsById={simsById} editing={null} onDone={onDone} onCancelEdit={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    await userEvent.type(screen.getByLabelText(/title/i), 'The feud begins')
    await userEvent.click(screen.getByRole('button', { name: /save milestone/i }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ legacyId: 'leg-1', title: 'The feud begins' }),
    )
    expect(onDone).toHaveBeenCalled()
  })

  it('disables save when the title is empty', async () => {
    render(
      <MilestoneComposer legacyId="leg-1" simsById={simsById} editing={null} onDone={vi.fn()} onCancelEdit={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    expect(screen.getByRole('button', { name: /save milestone/i })).toBeDisabled()
  })

  it('pre-fills the title and blurb when editing, and Save calls update (not create)', async () => {
    const editing: Milestone = {
      id: 'm1',
      kind: 'Note',
      gen: 3,
      simIds: ['s1'],
      title: 'On the back porch',
      blurb: 'Kind to each other tonight.',
      userAuthored: true,
      sortOrder: 100,
    }
    const onDone = vi.fn()
    render(
      <MilestoneComposer legacyId="leg-1" simsById={simsById} editing={editing} onDone={onDone} onCancelEdit={vi.fn()} />,
    )

    // The form is open and pre-filled from the editing milestone.
    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement
    const storyInput = screen.getByLabelText(/story/i) as HTMLTextAreaElement
    expect(titleInput.value).toBe('On the back porch')
    expect(storyInput.value).toBe('Kind to each other tonight.')

    await userEvent.click(screen.getByRole('button', { name: /save milestone/i }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1', title: 'On the back porch', blurb: 'Kind to each other tonight.' }),
    )
    expect(mockCreate).not.toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
  })
})
