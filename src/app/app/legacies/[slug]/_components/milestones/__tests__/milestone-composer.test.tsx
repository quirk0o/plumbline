// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MilestoneComposer } from '../milestone-composer'
import type { ChronicleSim } from '../../../lib/types'

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn().mockResolvedValue({ id: 'm-new' }) }))

vi.mock('@/trpc/client', () => ({
  trpc: {
    milestones: {
      create: { useMutation: vi.fn(() => ({ mutateAsync: mockCreate, isPending: false })) },
      update: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'm1' }), isPending: false })) },
    },
  },
}))

const simsById: Record<string, ChronicleSim> = {
  s1: { id: 's1', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 3, lifeStage: 'TEEN', isHeir: true, isFounder: false, aspirationName: null },
}

describe('MilestoneComposer', () => {
  it('creates a milestone with the entered title', async () => {
    const onDone = vi.fn()
    render(
      <MilestoneComposer legacyId="leg-1" slug="goth" simsById={simsById} editing={null} onDone={onDone} onCancelEdit={vi.fn()} />,
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
      <MilestoneComposer legacyId="leg-1" slug="goth" simsById={simsById} editing={null} onDone={vi.fn()} onCancelEdit={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /add milestone/i }))
    expect(screen.getByRole('button', { name: /save milestone/i })).toBeDisabled()
  })
})
