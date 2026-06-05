// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// External boundaries — mock the mutation + router; assert what the dialog
// persists and where it navigates, not its internals.
const mutateAsync = vi.fn().mockResolvedValue({})
const push = vi.fn()
vi.mock('@/trpc/client', () => ({
  trpc: {
    challengeRuns: {
      link: { useMutation: () => ({ mutateAsync, isPending: false }) },
    },
  },
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  class MockResizeObserver {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn()
  }
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})

import { StartRunDialog } from '../_components/start-run-dialog'

const legacies = [
  { id: 'leg-1', name: 'The Calientes', slug: 'the-calientes' },
  { id: 'leg-2', name: 'The Goths', slug: 'the-goths' },
]

function dialog() {
  return within(screen.getByRole('dialog'))
}

describe('StartRunDialog', () => {
  beforeEach(() => {
    mutateAsync.mockClear()
    push.mockClear()
  })

  it('starts a run on the chosen legacy and navigates to it', async () => {
    const user = userEvent.setup()
    render(
      <StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={legacies} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    await user.click(dialog().getByRole('button', { name: /choose a legacy/i }))
    await user.click(await screen.findByRole('option', { name: 'The Calientes' }))
    await user.click(dialog().getByRole('button', { name: 'Start run' }))

    expect(mutateAsync).toHaveBeenCalledWith({
      legacyId: 'leg-1',
      challengeId: 'ch-1',
      name: 'Legacy Challenge',
    })
    expect(push).toHaveBeenCalledWith('/app/legacies/the-calientes')
  })

  it('pre-fills the run name with the challenge name and sends edits', async () => {
    const user = userEvent.setup()
    render(
      <StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={legacies} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    const nameInput = dialog().getByLabelText('Run name')
    expect(nameInput).toHaveValue('Legacy Challenge')
    await user.clear(nameInput)
    await user.type(nameInput, 'Second attempt')
    await user.click(dialog().getByRole('button', { name: /choose a legacy/i }))
    await user.click(await screen.findByRole('option', { name: 'The Goths' }))
    await user.click(dialog().getByRole('button', { name: 'Start run' }))

    expect(mutateAsync).toHaveBeenCalledWith({
      legacyId: 'leg-2',
      challengeId: 'ch-1',
      name: 'Second attempt',
    })
  })

  it('requires choosing a legacy before starting', async () => {
    const user = userEvent.setup()
    render(
      <StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={legacies} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    await user.click(dialog().getByRole('button', { name: 'Start run' }))

    expect(await dialog().findByRole('alert')).toHaveTextContent(/choose a legacy/i)
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('keeps the dialog open and shows an error when the mutation fails', async () => {
    mutateAsync.mockRejectedValueOnce(new Error('boom'))
    const user = userEvent.setup()
    render(
      <StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={legacies} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    await user.click(dialog().getByRole('button', { name: /choose a legacy/i }))
    await user.click(await screen.findByRole('option', { name: 'The Calientes' }))
    await user.click(dialog().getByRole('button', { name: 'Start run' }))

    expect(await dialog().findByRole('alert')).toHaveTextContent(/could not start/i)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('prompts to create a legacy when there are none', async () => {
    const user = userEvent.setup()
    render(<StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={[]} />)

    await user.click(screen.getByRole('button', { name: 'Start run' }))

    expect(await screen.findByText(/need a legacy/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start a legacy' })).toHaveAttribute(
      'href',
      '/app/legacies/new',
    )
  })

  it('discards selection, name edits, and errors when the dialog is closed and reopened', async () => {
    const user = userEvent.setup()
    render(
      <StartRunDialog challengeId="ch-1" challengeName="Legacy Challenge" legacies={legacies} />,
    )

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    await user.click(dialog().getByRole('button', { name: /choose a legacy/i }))
    await user.click(await screen.findByRole('option', { name: 'The Calientes' }))
    const nameInput = dialog().getByLabelText('Run name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Scratch this')
    await user.click(dialog().getByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    expect(dialog().getByLabelText('Run name')).toHaveValue('Legacy Challenge')
    await user.click(dialog().getByRole('button', { name: 'Start run' }))
    expect(await dialog().findByRole('alert')).toHaveTextContent(/choose a legacy/i)
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
