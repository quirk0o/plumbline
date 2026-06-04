// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChronicleSim } from '../../../lib/types'

// External boundaries — mock the mutation + router; assert what the dialog
// persists, not its internals.
const mutateAsync = vi.fn().mockResolvedValue({})
const refresh = vi.fn()
vi.mock('@/trpc/client', () => ({
  trpc: {
    sims: { update: { useMutation: () => ({ mutateAsync, isPending: false }) } },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

import { NameHeirDialog } from '../name-heir-dialog'

function sim(
  over: Partial<ChronicleSim> & {
    id: string
    firstName: string
    lastName: string
  },
): ChronicleSim {
  return {
    imageUrl: null,
    generationNumber: 2,
    lifeStage: 'YOUNG_ADULT',
    isHeir: false,
    isFounder: false,
    aspirationName: null,
    ...over,
  }
}

const candidates = [
  sim({ id: 'reed', firstName: 'Reed', lastName: 'Caliente' }),
  sim({ id: 'nina', firstName: 'Nina', lastName: 'Caliente' }),
]

describe('NameHeirDialog', () => {
  beforeEach(() => {
    mutateAsync.mockClear()
    refresh.mockClear()
  })

  it('renders the trigger with the next-generation label', () => {
    render(
      <NameHeirDialog slug="caliente" nextHeirLabel="Gen II" candidates={candidates} />,
    )
    expect(
      screen.getByRole('button', { name: /Name an heir/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Gen II')).toBeInTheDocument()
  })

  it('designates the chosen sim as heir and refreshes', async () => {
    const user = userEvent.setup()
    render(
      <NameHeirDialog slug="caliente" nextHeirLabel="Gen II" candidates={candidates} />,
    )

    await user.click(screen.getByRole('button', { name: /Name an heir/i }))
    await user.click(await screen.findByRole('button', { name: /Reed Caliente/i }))

    expect(mutateAsync).toHaveBeenCalledWith({ id: 'reed', isHeir: true })
    expect(refresh).toHaveBeenCalled()
  })

  it('shows exactly the provided candidates as selectable options — no more, no less', async () => {
    const user = userEvent.setup()
    render(
      <NameHeirDialog slug="caliente" nextHeirLabel="Gen II" candidates={candidates} />,
    )

    await user.click(screen.getByRole('button', { name: /Name an heir/i }))

    // Both candidates appear as buttons.
    expect(await screen.findByRole('button', { name: /Reed Caliente/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nina Caliente/i })).toBeInTheDocument()

    // No extra sim names bleed in — only the two provided.
    const candidateButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.textContent && ['Reed Caliente', 'Nina Caliente'].some((name) => btn.textContent?.includes(name)))
    expect(candidateButtons).toHaveLength(2)
  })

  it('prompts to add a sim when there are no candidates', async () => {
    const user = userEvent.setup()
    render(<NameHeirDialog slug="caliente" nextHeirLabel="Gen II" candidates={[]} />)

    await user.click(screen.getByRole('button', { name: /Name an heir/i }))

    expect(await screen.findByText(/no one to name yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Add a Sim/i })).toHaveAttribute(
      'href',
      '/app/legacies/caliente/sims/new',
    )
  })
})
