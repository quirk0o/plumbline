// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Combobox } from '../combobox'

function Simple({ value = '', onChange = vi.fn() } = {}) {
  return (
    <Combobox value={value} onChange={onChange} placeholder="Pick a career…">
      <Combobox.Section heading="Arts">
        <Combobox.Item value="MUSICIAN">Musician</Combobox.Item>
        <Combobox.Item value="COMEDIAN">Comedian</Combobox.Item>
      </Combobox.Section>
      <Combobox.Item value="SCIENTIST">Scientist</Combobox.Item>
    </Combobox>
  )
}

describe('Combobox', () => {
  it('shows placeholder when no value is selected', () => {
    render(<Simple />)
    expect(screen.getByRole('button', { name: 'Pick a career…' })).toBeInTheDocument()
  })

  it('shows the selected item label in the trigger', async () => {
    render(<Simple value="MUSICIAN" />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Musician' })).toBeInTheDocument()
    )
  })

  it('opens the popover on trigger click', async () => {
    const user = userEvent.setup()
    render(<Simple />)
    await user.click(screen.getByRole('button', { name: 'Pick a career…' }))
    expect(screen.getByPlaceholderText('Search…')).toBeVisible()
  })

  it('renders group headings when open', async () => {
    const user = userEvent.setup()
    render(<Simple />)
    await user.click(screen.getByRole('button', { name: 'Pick a career…' }))
    expect(screen.getByText('Arts')).toBeVisible()
  })

  it('filters items by typing in the search input', async () => {
    const user = userEvent.setup()
    render(<Simple />)
    await user.click(screen.getByRole('button', { name: 'Pick a career…' }))
    await user.type(screen.getByPlaceholderText('Search…'), 'sci')
    expect(screen.getByText('Scientist')).toBeVisible()
    expect(screen.queryByText('Musician')).not.toBeVisible()
  })

  it('shows empty state when nothing matches', async () => {
    const user = userEvent.setup()
    render(<Simple />)
    await user.click(screen.getByRole('button', { name: 'Pick a career…' }))
    await user.type(screen.getByPlaceholderText('Search…'), 'zzzz')
    expect(screen.getByText(/no results/i)).toBeVisible()
  })

  it('calls onChange with the item value when an item is clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Simple onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Pick a career…' }))
    await user.click(screen.getByText('Scientist'))
    expect(onChange).toHaveBeenCalledWith('SCIENTIST')
  })

  it('closes the popover after selecting an item', async () => {
    const user = userEvent.setup()
    render(<Simple />)
    await user.click(screen.getByRole('button', { name: 'Pick a career…' }))
    await user.click(screen.getByText('Scientist'))
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search…')).not.toBeVisible()
    )
  })

  it('closes the popover on Escape', async () => {
    const user = userEvent.setup()
    render(<Simple />)
    await user.click(screen.getByRole('button', { name: 'Pick a career…' }))
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Search…')).not.toBeVisible()
    )
  })

  it('forwards id to the trigger for label association', () => {
    render(
      <>
        <label htmlFor="career-cb">Career</label>
        <Combobox id="career-cb" value="" onChange={vi.fn()} placeholder="Pick…">
          <Combobox.Item value="A">Alpha</Combobox.Item>
        </Combobox>
      </>
    )
    expect(screen.getByLabelText('Career')).toBeInTheDocument()
  })

  it('disables the trigger when disabled prop is set', () => {
    render(
      <Combobox value="" onChange={vi.fn()} disabled placeholder="Pick…">
        <Combobox.Item value="A">Alpha</Combobox.Item>
      </Combobox>
    )
    expect(screen.getByRole('button', { name: 'Pick…' })).toBeDisabled()
  })
})
