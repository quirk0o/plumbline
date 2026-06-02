// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// The update mutation is the external boundary — mock it and assert what the
// toggle persists, not how the component is wired internally.
const mutateAsync = vi.fn().mockResolvedValue({})
vi.mock('@/trpc/client', () => ({
  trpc: { sims: { update: { useMutation: () => ({ mutateAsync }) } } },
}))

vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => <span aria-label={props.alt} />,
}))

vi.mock('@/app/components/image-upload', () => ({
  ImageUpload: () => <div data-testid="image-upload" />,
}))

// Combobox has no jsdom-friendly rendering here and is irrelevant to the heir
// toggle, so stub it to a plain wrapper that preserves its aria-label.
vi.mock('@/components/ui', () => {
  const Combobox = Object.assign(
    ({
      children,
      'aria-label': ariaLabel,
    }: {
      children?: React.ReactNode
      'aria-label'?: string
    }) => <div aria-label={ariaLabel}>{children}</div>,
    { Item: ({ children }: { children?: React.ReactNode }) => <span>{children}</span> },
  )
  return { Combobox }
})

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
}

describe('IdentitySection — heir toggle', () => {
  beforeEach(() => {
    mutateAsync.mockClear()
  })

  it('renders the heir toggle unpressed for a non-heir sim', () => {
    render(<IdentitySection sim={baseSim} />)
    expect(screen.getByRole('button', { name: 'Heir' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('marks the sim as heir on click and persists via the update mutation', async () => {
    const user = userEvent.setup()
    render(<IdentitySection sim={baseSim} />)

    const toggle = screen.getByRole('button', { name: 'Heir' })
    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'sim-1', isHeir: true })
  })

  it('reflects an existing heir as pressed and can unset it', async () => {
    const user = userEvent.setup()
    render(<IdentitySection sim={{ ...baseSim, isHeir: true }} />)

    const toggle = screen.getByRole('button', { name: 'Heir' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(mutateAsync).toHaveBeenCalledWith({ id: 'sim-1', isHeir: false })
  })

  it('reverts the toggle and surfaces an error when the save fails', async () => {
    const user = userEvent.setup()
    mutateAsync.mockRejectedValueOnce(new Error('save failed'))
    render(<IdentitySection sim={baseSim} />)

    const toggle = screen.getByRole('button', { name: 'Heir' })
    await user.click(toggle)

    // The optimistic flip rolls back once the mutation rejects.
    expect(await screen.findByText('Failed to save')).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
  })
})
