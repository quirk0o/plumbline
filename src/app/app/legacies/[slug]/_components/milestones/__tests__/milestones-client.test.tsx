// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MilestonesClient } from '../milestones-client'
import type { Milestone, ChronicleSim } from '../../../lib/types'

vi.mock('@/trpc/client', () => ({
  trpc: {
    milestones: {
      create: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      update: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      delete: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
      reorder: { useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const simsById: Record<string, ChronicleSim> = {
  s1: { id: 's1', firstName: 'Reed', lastName: 'Caliente', imageUrl: null, generationNumber: 3, lifeStage: 'TEEN', isHeir: true, isFounder: false, aspirationName: null },
}

const milestones: Milestone[] = [
  { id: 'birth-s1', kind: 'Birth', gen: 3, simIds: ['s1'], title: 'Reed Caliente is born', blurb: null, userAuthored: false, sortOrder: 200 },
  { id: 'm1', kind: 'Note', gen: 3, simIds: ['s1'], title: 'On the back porch', blurb: 'Kind to each other tonight.', userAuthored: true, sortOrder: 100 },
]

describe('MilestonesClient', () => {
  it('renders auto and user rows', () => {
    render(<MilestonesClient milestones={milestones} simsById={simsById} slug="goth" legacyId="leg-1" />)
    expect(screen.getByText('Reed Caliente is born')).toBeInTheDocument()
    expect(screen.getByText('On the back porch')).toBeInTheDocument()
  })

  it('shows the composer trigger', () => {
    render(<MilestonesClient milestones={[]} simsById={{}} slug="goth" legacyId="leg-1" />)
    expect(screen.getByRole('button', { name: /add milestone/i })).toBeInTheDocument()
  })
})
