// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { AtlasToolbar } from '../atlas-toolbar'

const baseProps = {
  legacySlug: 'caliente',
  generations: [1, 2, 3],
  genFilter: 'all' as const,
  query: '',
}

describe('AtlasToolbar', () => {
  it('renders a pill per present generation plus All, with the active one pressed', () => {
    render(<AtlasToolbar {...baseProps} genFilter={2} onGenChange={() => {}} onQueryChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Gen II' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Gen III' })).toBeInTheDocument()
  })

  it('raises onGenChange with the chosen generation', async () => {
    const onGenChange = vi.fn()
    const user = userEvent.setup()
    render(<AtlasToolbar {...baseProps} onGenChange={onGenChange} onQueryChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Gen I' }))
    expect(onGenChange).toHaveBeenCalledWith(1)
  })

  it('raises onQueryChange as the user types', async () => {
    const onQueryChange = vi.fn()
    const user = userEvent.setup()
    function Harness() {
      const [q, setQ] = useState('')
      return (
        <AtlasToolbar
          {...baseProps}
          query={q}
          onGenChange={() => {}}
          onQueryChange={(v) => {
            setQ(v)
            onQueryChange(v)
          }}
        />
      )
    }
    render(<Harness />)
    await user.type(screen.getByRole('searchbox', { name: /search this lineage/i }), 'Re')
    expect(onQueryChange).toHaveBeenLastCalledWith('Re')
  })

  it('links Add sim to the new-sim route', () => {
    render(<AtlasToolbar {...baseProps} onGenChange={() => {}} onQueryChange={() => {}} />)
    expect(screen.getByRole('link', { name: /add sim/i })).toHaveAttribute(
      'href',
      '/app/legacies/caliente/sims/new',
    )
  })
})
