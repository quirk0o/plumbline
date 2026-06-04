// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateSimModal } from '../create-sim-modal'
import { trpc } from '@/trpc/client'

const { mockMutateAsync, mockUseMutation } = vi.hoisted(() => {
  const mockMutateAsync = vi.fn()
  const mockUseMutation = vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false }))
  return { mockMutateAsync, mockUseMutation }
})

vi.mock('@/trpc/client', () => ({
  trpc: {
    traits: { getAll: { useQuery: vi.fn(() => ({ data: [{ id: 't1', name: 'Creative', category: 'HOBBY', conflictsWith: [] }], isLoading: false })) } },
    aspirations: { getAll: { useQuery: vi.fn(() => ({ data: [{ id: 'a1', name: 'Painter Extraordinaire', category: 'CREATIVITY' }], isLoading: false })) } },
    careers: { getAll: { useQuery: vi.fn(() => ({ data: [{ id: 'c1', name: 'Painter', type: 'STANDARD' }], isLoading: false })) } },
    sims: { create: { useMutation: mockUseMutation } },
  },
}))

vi.mock('../image-upload', () => ({ ImageUpload: () => null }))
vi.mock('../trait-picker', () => ({
  TraitPicker: ({ onChange }: { onChange: (ids: string[]) => void }) => (
    <button type="button" onClick={() => onChange([])}>Traits</button>
  ),
}))

describe('CreateSimModal', () => {
  it('shows loading state while queries are pending', () => {
    vi.mocked(trpc.traits.getAll.useQuery).mockReturnValueOnce({ data: undefined, isLoading: true } as unknown as ReturnType<typeof trpc.traits.getAll.useQuery>)
    render(<CreateSimModal legacyId="leg-1" onCreated={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders the sim form when data is loaded', () => {
    render(<CreateSimModal legacyId="leg-1" onCreated={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Create new sim' })).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
  })

  it('calls onClose when Back is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<CreateSimModal legacyId="leg-1" onCreated={vi.fn()} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls sims.create and then onCreated with the new sim on submit', async () => {
    const newSim = { id: 'sim-new', firstName: 'Nina', lastName: 'Caliente', imageUrl: null, gender: 'FEMALE', lifeStage: 'YOUNG_ADULT' }
    mockMutateAsync.mockResolvedValueOnce(newSim)
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<CreateSimModal legacyId="leg-1" onCreated={onCreated} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(/first name/i), 'Nina')
    await user.type(screen.getByLabelText(/last name/i), 'Caliente')

    await user.click(screen.getByRole('button', { name: /create sim/i }))

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ legacyId: 'leg-1', firstName: 'Nina', lastName: 'Caliente' })
      )
      expect(onCreated).toHaveBeenCalledWith({
        id: 'sim-new', firstName: 'Nina', lastName: 'Caliente', imageUrl: null,
      })
    })
  })
})
