// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Select } from '../select'

describe('Select', () => {
  it('renders a combobox with children', () => {
    render(
      <Select id="test">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </Select>
    )
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument()
  })

  it('forwards id so a label can associate with it', () => {
    render(
      <>
        <label htmlFor="my-select">Colour</label>
        <Select id="my-select">
          <option value="red">Red</option>
        </Select>
      </>
    )
    expect(screen.getByLabelText('Colour')).toBeInTheDocument()
  })

  it('forwards disabled attribute', () => {
    render(
      <Select id="test" disabled>
        <option value="x">X</option>
      </Select>
    )
    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('renders an aria-hidden decorative chevron', () => {
    const { container } = render(
      <Select id="test">
        <option value="x">X</option>
      </Select>
    )
    const chevron = container.querySelector('[aria-hidden="true"]')
    expect(chevron).toBeInTheDocument()
  })
})
