// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditableHeading } from '../editable-heading'
import { EditableText } from '../editable-text'
import { EditableStat } from '../editable-stat'

describe('EditableHeading', () => {
  it('commits a changed value on Enter', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<EditableHeading value="Goth Manor" onCommit={onCommit} aria-label="Household name" />)

    await user.click(screen.getByRole('button', { name: 'Goth Manor' }))
    const input = screen.getByRole('textbox', { name: 'Household name' })
    await user.clear(input)
    await user.type(input, 'Caliente Villa{Enter}')

    expect(onCommit).toHaveBeenCalledWith('Caliente Villa')
  })

  it('does not commit an empty or unchanged value', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<EditableHeading value="Goth Manor" onCommit={onCommit} aria-label="Household name" />)

    await user.click(screen.getByRole('button', { name: 'Goth Manor' }))
    await user.clear(screen.getByRole('textbox', { name: 'Household name' }))
    await user.keyboard('{Enter}')
    expect(onCommit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Goth Manor' }))
    await user.keyboard('{Enter}') // unchanged
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('cancels on Escape', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<EditableHeading value="Goth Manor" onCommit={onCommit} aria-label="Household name" />)

    await user.click(screen.getByRole('button', { name: 'Goth Manor' }))
    await user.type(screen.getByRole('textbox', { name: 'Household name' }), 'X{Escape}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Goth Manor' })).toBeInTheDocument()
  })

  it('starts in edit mode with autoEdit', () => {
    render(<EditableHeading value="New household" onCommit={vi.fn()} autoEdit aria-label="Household name" />)
    expect(screen.getByRole('textbox', { name: 'Household name' })).toBeInTheDocument()
  })
})

describe('EditableText', () => {
  it('shows the placeholder when empty and commits typed text on blur', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(
      <EditableText value="" onCommit={onCommit} placeholder="Add a note…" aria-label="Description" />,
    )

    await user.click(screen.getByRole('button', { name: 'Add a note…' }))
    await user.type(screen.getByRole('textbox', { name: 'Description' }), 'The founding home.')
    await user.tab() // blur commits

    expect(onCommit).toHaveBeenCalledWith('The founding home.')
  })
})

describe('EditableStat', () => {
  it('renders simoleons and commits the parsed integer', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<EditableStat value={20000} label="Funds" onCommit={onCommit} />)

    expect(screen.getByText('§20,000')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Funds/i }))
    const input = screen.getByRole('textbox', { name: /Funds/i })
    await user.clear(input)
    await user.type(input, '35500{Enter}')

    expect(onCommit).toHaveBeenCalledWith(35500)
  })

  it('reverts on invalid input instead of committing', async () => {
    const user = userEvent.setup()
    const onCommit = vi.fn()
    render(<EditableStat value={100} label="Funds" onCommit={onCommit} />)

    await user.click(screen.getByRole('button', { name: /Funds/i }))
    await user.clear(screen.getByRole('textbox', { name: /Funds/i }))
    await user.keyboard('{Enter}')

    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('§100')).toBeInTheDocument()
  })
})
