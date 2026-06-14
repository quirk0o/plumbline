// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RelationshipsEditor } from '../relationships-editor'

const { addSocialMock, updateSocialMock, removeSocialMock, addFamilyMock, removeFamilyMock } = vi.hoisted(() => ({
  addSocialMock: vi.fn(),
  updateSocialMock: vi.fn(),
  removeSocialMock: vi.fn(),
  addFamilyMock: vi.fn(),
  removeFamilyMock: vi.fn(),
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    sims: {
      family: {
        add: { useMutation: () => ({ mutate: addFamilyMock }) },
        remove: { useMutation: () => ({ mutate: removeFamilyMock }) },
      },
      social: {
        add: { useMutation: () => ({ mutate: addSocialMock }) },
        update: { useMutation: () => ({ mutate: updateSocialMock }) },
        remove: { useMutation: () => ({ mutate: removeSocialMock }) },
      },
    },
  },
}))

type Partner = { id: string; firstName: string; lastName: string; imageUrl: string | null; causeOfDeath: string | null }

function makeSim(partner: Partner, endedAt: Date | null) {
  const [a, b] = ['focus', partner.id].sort()
  return {
    id: 'focus',
    legacyId: 'leg-1',
    parentsOf: [],
    childOf: [],
    socialRelationshipsA: [
      { simAId: a, simBId: b, romanticStatus: 'MARRIED', endedAt, simB: partner },
    ],
    socialRelationshipsB: [],
  }
}

const alivePartner: Partner = { id: 'spouse', firstName: 'Mortimer', lastName: 'Goth', imageUrl: null, causeOfDeath: null }
const deadPartner: Partner = { id: 'spouse', firstName: 'Mortimer', lastName: 'Goth', imageUrl: null, causeOfDeath: 'OLD_AGE' }

beforeEach(() => {
  addSocialMock.mockReset()
  updateSocialMock.mockReset()
})

describe('RelationshipsEditor — ending a bond', () => {
  it('ending a marriage calls updateSocialRelationship with a non-null endedAt and shows a Divorced badge', async () => {
    const user = userEvent.setup()
    render(<RelationshipsEditor sim={makeSim(alivePartner, null)} slug="goth" legacySims={[]} />)

    await user.click(screen.getByRole('button', { name: /divorce/i }))

    expect(updateSocialMock).toHaveBeenCalledWith(
      expect.objectContaining({ romanticStatus: 'MARRIED', endedAt: expect.any(Date) }),
      expect.anything(),
    )
    expect(screen.getByText('Divorced')).toBeInTheDocument()
  })

  it('shows a derived Widowed badge with no end control when the partner is deceased', () => {
    render(<RelationshipsEditor sim={makeSim(deadPartner, null)} slug="goth" legacySims={[]} />)

    expect(screen.getByText('Widowed')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /divorce/i })).not.toBeInTheDocument()
  })

  it('an ended marriage shows a Reopen control that clears endedAt', async () => {
    const user = userEvent.setup()
    render(<RelationshipsEditor sim={makeSim(alivePartner, new Date('2026-01-01'))} slug="goth" legacySims={[]} />)

    expect(screen.getByText('Divorced')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reopen/i }))

    expect(updateSocialMock).toHaveBeenCalledWith(
      expect.objectContaining({ romanticStatus: 'MARRIED', endedAt: null }),
      expect.anything(),
    )
  })
})
