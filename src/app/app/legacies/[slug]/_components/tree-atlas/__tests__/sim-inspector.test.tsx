// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock('next/image', () => ({
  default: ({ alt }: { src: string; alt: string }) => <span>{alt}</span>,
}))

const { mockUseQuery } = vi.hoisted(() => ({ mockUseQuery: vi.fn() }))
vi.mock('@/trpc/client', () => ({
  trpc: { sims: { getById: { useQuery: mockUseQuery } } },
}))

import { SimInspector } from '../sim-inspector'

const SIM = {
  id: 'reed',
  firstName: 'Reed',
  lastName: 'Caliente',
  imageUrl: null,
  lifeStage: 'TEEN',
  isHeir: true,
  generationNumber: 3,
  personalityTraits: [
    { personalityTrait: { name: 'Genius' } },
    { personalityTrait: { name: 'Foodie' } },
  ],
  aspirations: [{ aspiration: { name: 'Successful Lineage' } }],
  childOf: [
    { parent: { id: 'a', firstName: 'Alexander', lastName: 'Goth' } },
    { parent: { id: 'e', firstName: 'Eliza', lastName: 'Pancakes' } },
  ],
  socialRelationshipsA: [],
  socialRelationshipsB: [],
}

const baseProps = { simId: 'reed', legacySlug: 'caliente', founderSimId: 'dina', onClose: () => {} }

describe('SimInspector', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: SIM, isLoading: false, isError: false })
  })

  it('shows the sim name, life stage, aspiration, traits and parents', () => {
    render(<SimInspector {...baseProps} />)
    expect(screen.getByText('Reed Caliente')).toBeInTheDocument()
    expect(screen.getByText(/Teen/)).toBeInTheDocument()
    expect(screen.getByText('Successful Lineage')).toBeInTheDocument()
    expect(screen.getByText('Genius')).toBeInTheDocument()
    expect(screen.getByText(/Alexander Goth · Eliza Pancakes/)).toBeInTheDocument()
  })

  it('labels the current heir', () => {
    render(<SimInspector {...baseProps} />)
    expect(screen.getByText(/current heir/i)).toBeInTheDocument()
  })

  it('links "Open profile" to the sim detail route with a named aria-label', () => {
    render(<SimInspector {...baseProps} />)
    const link = screen.getByRole('link', { name: "Open Reed Caliente's profile" })
    expect(link).toHaveAttribute('href', '/app/legacies/caliente/sims/reed')
  })

  it('calls onClose from the ✕ button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SimInspector {...baseProps} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /close sim details/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a loading state while fetching', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<SimInspector {...baseProps} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error state', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<SimInspector {...baseProps} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<SimInspector {...baseProps} onClose={onClose} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('labels a non-heir, non-founder sim with its generation', () => {
    mockUseQuery.mockReturnValue({
      data: { ...SIM, isHeir: false, generationNumber: 2 },
      isLoading: false,
      isError: false,
    })
    render(<SimInspector {...baseProps} founderSimId="someone-else" />)
    expect(screen.getByText(/selected · gen ii/i)).toBeInTheDocument()
  })

  const partnerRow = (status: string, endedAt: string | null) => ({
    romanticStatus: status,
    endedAt,
    simB: { id: 'mate', firstName: 'Marnie', lastName: 'Mate', imageUrl: null },
  })

  it('surfaces a current partner under the Partner heading', () => {
    mockUseQuery.mockReturnValue({
      data: { ...SIM, socialRelationshipsA: [partnerRow('MARRIED', null)], socialRelationshipsB: [] },
      isLoading: false, isError: false,
    })
    render(<SimInspector {...baseProps} />)
    expect(screen.getByText('Partner')).toBeInTheDocument()
    expect(screen.getByText('Marnie Mate')).toBeInTheDocument()
  })

  it('does NOT surface an ended (divorced) bond as the current partner', () => {
    mockUseQuery.mockReturnValue({
      data: { ...SIM, socialRelationshipsA: [partnerRow('MARRIED', '2026-01-01T00:00:00.000Z')], socialRelationshipsB: [] },
      isLoading: false, isError: false,
    })
    render(<SimInspector {...baseProps} />)
    expect(screen.queryByText('Marnie Mate')).not.toBeInTheDocument()
  })
})
