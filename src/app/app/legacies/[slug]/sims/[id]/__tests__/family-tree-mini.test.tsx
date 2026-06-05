// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Stand-in for the real canvas: renders the group label (so we can assert the
// accessible name LineageFlow derives from legacyName) and a button wired to
// onSelectSim, mirroring a node click.
vi.mock('@/components/lineage-tree/lineage-flow', () => ({
  LineageFlow: ({
    legacyName,
    sims,
    onSelectSim,
  }: {
    legacyName?: string
    sims: { id: string }[]
    onSelectSim?: (id: string) => void
  }) => (
    <div role="group" aria-label={`${legacyName ?? 'Family'} tree — ${sims.length} sims`}>
      <button type="button" data-testid="lineage-flow" onClick={() => onSelectSim?.('s2')}>
        tree
      </button>
    </div>
  ),
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

const WITH_FAMILY = {
  data: {
    sims: [
      { id: 's1', firstName: 'Mortimer', lastName: 'Goth', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: false, href: '/app/legacies/goth/sims/s1' },
      { id: 's2', firstName: 'Bella', lastName: 'Goth', imageUrl: null, generationNumber: 1, lifeStage: 'ADULT', isHeir: true, href: '/app/legacies/goth/sims/s2' },
    ],
    familyEdges: [],
    partnerEdges: [{ simAId: 's1', simBId: 's2' }],
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
    expect(screen.getByRole('group', { name: /Goth tree — 2 sims/i })).toBeInTheDocument()
  })

  it('navigates to a sim href when its node is selected', async () => {
    const user = userEvent.setup()
    render(<FamilyTreeMini simId="s1" />)
    await user.click(screen.getByTestId('lineage-flow'))
    expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth/sims/s2')
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
    expect(screen.queryByTestId('lineage-flow')).not.toBeInTheDocument()
  })
})
