// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// External boundary: the Next.js router. The component's observable behavior
// is the URL it asks the router to replace.
const replace = vi.fn()
let params: URLSearchParams
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => params,
}))

import { ChallengeSearch } from '../_components/challenge-search'

describe('ChallengeSearch', () => {
  beforeEach(() => {
    replace.mockClear()
    params = new URLSearchParams()
  })

  it('debounces typing into a single URL update with the query', async () => {
    const user = userEvent.setup()
    render(<ChallengeSearch />)

    await user.type(screen.getByRole('searchbox', { name: 'Search challenges' }), 'legacy')

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/app/challenges?q=legacy', { scroll: false }),
    )
    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('preserves the current tab when searching', async () => {
    params = new URLSearchParams('tab=mine')
    const user = userEvent.setup()
    render(<ChallengeSearch />)

    await user.type(screen.getByRole('searchbox', { name: 'Search challenges' }), 'rags')

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/app/challenges?tab=mine&q=rags', { scroll: false }),
    )
  })

  it('drops q from the URL when the input is cleared', async () => {
    params = new URLSearchParams('q=legacy')
    const user = userEvent.setup()
    render(<ChallengeSearch />)

    const input = screen.getByRole('searchbox', { name: 'Search challenges' })
    expect(input).toHaveValue('legacy')
    await user.clear(input)

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/app/challenges', { scroll: false }),
    )
  })

  it('does not push to the URL on mount when seeded from an existing query', async () => {
    params = new URLSearchParams('q=legacy')
    render(<ChallengeSearch />)

    expect(screen.getByRole('searchbox', { name: 'Search challenges' })).toHaveValue('legacy')

    await new Promise((r) => setTimeout(r, 400))
    expect(replace).not.toHaveBeenCalled()
  })

  it('adopts an external URL change into the input without re-pushing', async () => {
    params = new URLSearchParams('q=legacy')
    const { rerender } = render(<ChallengeSearch />)

    const input = screen.getByRole('searchbox', { name: 'Search challenges' })
    expect(input).toHaveValue('legacy')

    // Simulate Back/forward: the URL loses `q`. The mock reads module-level
    // `params` at render, so reassign + rerender to surface the new value.
    params = new URLSearchParams()
    rerender(<ChallengeSearch />)

    await waitFor(() => expect(input).toHaveValue(''))

    await new Promise((r) => setTimeout(r, 400))
    expect(replace).not.toHaveBeenCalled()
  })
})
