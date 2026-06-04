// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LegacyWizard } from '../legacy-wizard'
import { trpc } from '@/trpc/client'

const { mockMutateAsync, mockUseMutation, mockRouterPush, mockRouterBack } = vi.hoisted(() => {
  const mockMutateAsync = vi.fn()
  const mockUseMutation = vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false, error: null }))
  return {
    mockMutateAsync,
    mockUseMutation,
    mockRouterPush: vi.fn(),
    mockRouterBack: vi.fn(),
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack }),
}))

vi.mock('@/trpc/client', () => ({
  trpc: {
    traits: { getAll: { useQuery: vi.fn(() => ({ data: [], isLoading: false })) } },
    aspirations: { getAll: { useQuery: vi.fn(() => ({ data: [], isLoading: false })) } },
    careers: { getAll: { useQuery: vi.fn(() => ({ data: [], isLoading: false })) } },
    legacies: { create: { useMutation: mockUseMutation } },
  },
}))

vi.mock('@/app/components/image-upload', () => ({ ImageUpload: () => null }))

describe('LegacyWizard', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset()
    mockUseMutation.mockReset()
    mockUseMutation.mockImplementation(() => ({ mutateAsync: mockMutateAsync, isPending: false, error: null }))
    mockRouterPush.mockReset()
    mockRouterBack.mockReset()
    vi.mocked(trpc.traits.getAll.useQuery).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof trpc.traits.getAll.useQuery>)
    vi.mocked(trpc.aspirations.getAll.useQuery).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof trpc.aspirations.getAll.useQuery>)
    vi.mocked(trpc.careers.getAll.useQuery).mockReturnValue({ data: [], isLoading: false } as ReturnType<typeof trpc.careers.getAll.useQuery>)
  })

  it('shows a validation error and stays on step 1 when Continue is clicked with an empty name', async () => {
    const user = userEvent.setup()
    render(<LegacyWizard />)

    await user.click(screen.getByRole('button', { name: 'Continue →' }))

    expect(await screen.findByText('Legacy name is required')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your Legacy' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Founder Sim' })).not.toBeInTheDocument()
  })

  it('advances to the founder step when a name is filled and Continue is clicked', async () => {
    const user = userEvent.setup()
    render(<LegacyWizard />)

    await user.type(screen.getByLabelText(/legacy name/i), 'The Caliente Legacy')
    await user.click(screen.getByRole('button', { name: 'Continue →' }))

    expect(await screen.findByRole('heading', { name: 'Founder Sim' })).toBeInTheDocument()
  })

  it('returns to step 1 with the typed name preserved when Back is clicked on step 2', async () => {
    const user = userEvent.setup()
    render(<LegacyWizard />)

    await user.type(screen.getByLabelText(/legacy name/i), 'The Caliente Legacy')
    await user.click(screen.getByRole('button', { name: 'Continue →' }))
    expect(await screen.findByRole('heading', { name: 'Founder Sim' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(await screen.findByRole('heading', { name: 'Your Legacy' })).toBeInTheDocument()
    expect(screen.getByLabelText<HTMLInputElement>(/legacy name/i).value).toBe('The Caliente Legacy')
  })
})
