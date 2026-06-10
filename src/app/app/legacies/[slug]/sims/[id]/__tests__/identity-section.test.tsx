// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// The update mutation is the external transport boundary — mock the tRPC
// client and assert what the chips persist, not how they're wired internally.
// Everything we own (Combobox, ImageUpload) renders for real.
const mutateAsync = vi.fn().mockResolvedValue({})
vi.mock('@/trpc/client', () => ({
  trpc: { sims: { update: { useMutation: () => ({ mutateAsync }) } } },
}))

vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

import { IdentitySection } from '../identity-section'

const baseSim = {
  id: 'sim-1',
  firstName: 'Dina',
  lastName: 'Caliente',
  gender: 'FEMALE',
  lifeStage: 'ADULT',
  pronounSubject: null,
  pronounObject: null,
  pronounPossessive: null,
  imageUrl: null,
  occultType: null,
  isHeir: false,
  generationNumber: 1,
}

/**
 * Open a real Combobox by clicking its trigger (found via its accessible
 * name — the aria-label when nothing is selected, or the current value's
 * visible label once one is) and click the option with the given name.
 */
async function openAndSelect(
  user: ReturnType<typeof userEvent.setup>,
  triggerName: string | RegExp,
  optionName: string | RegExp,
) {
  await user.click(screen.getByRole('button', { name: triggerName }))
  await user.click(await screen.findByRole('option', { name: optionName }))
}

describe('IdentitySection — identity chips', () => {
  beforeEach(() => {
    mutateAsync.mockClear()
  })

  it('renders the heir toggle unpressed for a non-heir sim', () => {
    render(<IdentitySection sim={baseSim} hasParents={false} />)
    expect(screen.getByRole('button', { name: 'Heir' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('marks the sim as heir on click and persists via the update mutation', async () => {
    const user = userEvent.setup()
    render(<IdentitySection sim={baseSim} hasParents={false} />)

    const toggle = screen.getByRole('button', { name: 'Heir' })
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'sim-1', isHeir: true })
  })

  it('reflects an existing heir as pressed and can unset it', async () => {
    const user = userEvent.setup()
    render(<IdentitySection sim={{ ...baseSim, isHeir: true }} hasParents={false} />)

    const toggle = screen.getByRole('button', { name: 'Heir' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'sim-1', isHeir: false })
  })

  it('reverts the toggle and surfaces an error when the save fails', async () => {
    const user = userEvent.setup()
    mutateAsync.mockRejectedValueOnce(new Error('save failed'))
    render(<IdentitySection sim={baseSim} hasParents={false} />)

    const toggle = screen.getByRole('button', { name: 'Heir' })
    await user.click(toggle)

    // The optimistic flip rolls back once the mutation rejects.
    expect(await screen.findByText('Failed to save')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('persists a new gender when selected', async () => {
    const user = userEvent.setup()
    render(<IdentitySection sim={baseSim} hasParents={false} />)

    await openAndSelect(user, 'Female', 'Male')

    expect(mutateAsync).toHaveBeenCalledWith({ id: 'sim-1', gender: 'MALE' })
  })

  it('persists a new life stage when selected', async () => {
    const user = userEvent.setup()
    render(<IdentitySection sim={baseSim} hasParents={false} />)

    await openAndSelect(user, 'Adult', 'Elder')

    expect(mutateAsync).toHaveBeenCalledWith({ id: 'sim-1', lifeStage: 'ELDER' })
  })

  it('persists an occult type when selected from the default human chip', async () => {
    const user = userEvent.setup()
    render(<IdentitySection sim={baseSim} hasParents={false} />)

    await openAndSelect(user, 'Occult type', 'Vampire')

    expect(mutateAsync).toHaveBeenCalledWith({ id: 'sim-1', occultType: 'VAMPIRE' })
  })

  it('shows generation read-only for a sim with parents', () => {
    render(<IdentitySection sim={{ ...baseSim, generationNumber: 3 }} hasParents />)
    expect(screen.getByText('Gen III')).toBeInTheDocument()
    // No editable Generation control for a derived sim.
    expect(screen.queryByRole('button', { name: /Generation|Gen / })).not.toBeInTheDocument()
  })

  it('shows an editable Generation control for a root sim', async () => {
    render(<IdentitySection sim={{ ...baseSim, generationNumber: 2 }} hasParents={false} />)
    // The trigger shows the current generation as its accessible name.
    expect(await screen.findByRole('button', { name: 'Gen II' })).toBeInTheDocument()
  })

  it('persists a new generation via the update mutation when selected', async () => {
    const user = userEvent.setup()
    render(<IdentitySection sim={{ ...baseSim, generationNumber: 1 }} hasParents={false} />)

    await openAndSelect(user, 'Gen I', 'Gen IV')

    expect(mutateAsync).toHaveBeenCalledWith({ id: 'sim-1', generationNumber: 4 })
  })

  it('reverts the generation and surfaces an error when the save fails', async () => {
    const user = userEvent.setup()
    mutateAsync.mockRejectedValueOnce(new Error('save failed'))
    render(<IdentitySection sim={{ ...baseSim, generationNumber: 2 }} hasParents={false} />)

    await openAndSelect(user, 'Gen II', 'Gen V')

    // The optimistic change rolls back once the mutation rejects, so the
    // trigger shows the prior value again and the error surfaces.
    expect(await screen.findByText('Failed to save')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Gen II' })).toBeInTheDocument()
    )
  })
})
