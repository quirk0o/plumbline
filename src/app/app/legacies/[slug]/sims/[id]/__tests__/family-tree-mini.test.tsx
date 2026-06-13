// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const { mockUseQuery } = vi.hoisted(() => ({ mockUseQuery: vi.fn() }))

vi.mock('@/trpc/client', () => ({
  trpc: {
    sims: {
      getMiniTreeData: {
        useQuery: mockUseQuery,
      },
    },
  },
}))

// Import AFTER mocks are set up
import { FamilyTreeMini } from '../family-tree-mini'

// FamilyTreeMini wraps its own <ReactFlowProvider> — no need to add one here.
// All required LineageFlowSim fields are present (isDeceased, gender, etc.).
const WITH_FAMILY = {
  data: {
    sims: [
      {
        id: 's1',
        firstName: 'Mortimer',
        lastName: 'Goth',
        imageUrl: null,
        generationNumber: 1,
        lifeStage: 'ADULT' as const,
        isHeir: false,
        isDeceased: false,
        gender: 'MALE' as const,
        href: '/app/legacies/goth/sims/s1',
      },
      {
        id: 's2',
        firstName: 'Bella',
        lastName: 'Goth',
        imageUrl: null,
        generationNumber: 1,
        lifeStage: 'ADULT' as const,
        isHeir: true,
        isDeceased: false,
        gender: 'FEMALE' as const,
        href: '/app/legacies/goth/sims/s2',
      },
    ],
    familyEdges: [],
    partnerEdges: [{ simAId: 's1', simBId: 's2', romanticStatus: 'MARRIED' as const, endedAt: null }],
  },
  isLoading: false,
  isError: false,
}

describe('FamilyTreeMini', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue(WITH_FAMILY)
    mockPush.mockClear()
  })

  it('labels the tree group with the focused sim family name', () => {
    render(<FamilyTreeMini simId="s1" />)
    expect(screen.getByRole('group', { name: 'Goth tree — 2 sims' })).toBeInTheDocument()
  })

  it('navigates to a sim href when its node is selected', async () => {
    const user = userEvent.setup()
    render(<FamilyTreeMini simId="s1" />)
    // Click Mortimer Goth's node (id s1 → href /app/legacies/goth/sims/s1).
    // Mortimer is the focused sim so his label stays "Adult" (no kinship override).
    await user.click(screen.getByRole('button', { name: 'Mortimer Goth, Adult' }))
    expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth/sims/s1')
  })

  it('shows a loading state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<FamilyTreeMini simId="s1" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<FamilyTreeMini simId="s1" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows an empty state when the sim has no recorded family', () => {
    mockUseQuery.mockReturnValue({
      data: {
        sims: [WITH_FAMILY.data.sims[0]],
        familyEdges: [],
        partnerEdges: [],
      },
      isLoading: false,
      isError: false,
    })
    render(<FamilyTreeMini simId="s1" />)
    expect(screen.getByText(/no recorded family yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mortimer Goth/ })).not.toBeInTheDocument()
  })
})
