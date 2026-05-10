// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TraitPicker } from '../trait-picker'

const traits = [
  { id: 'neat', name: 'Neat', category: 'LIFESTYLE', conflictsWith: ['slob'] },
  { id: 'slob', name: 'Slob', category: 'LIFESTYLE', conflictsWith: ['neat'] },
  { id: 'good', name: 'Good', category: 'EMOTIONAL', conflictsWith: ['evil'] },
  { id: 'evil', name: 'Evil', category: 'EMOTIONAL', conflictsWith: ['good'] },
  { id: 'bookworm', name: 'Bookworm', category: 'HOBBY', conflictsWith: [] },
]

describe('TraitPicker', () => {
  it('renders all traits', () => {
    render(<TraitPicker traits={traits} selected={[]} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Neat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bookworm' })).toBeInTheDocument()
  })

  it('calls onChange with the selected trait id when a trait is clicked', () => {
    const onChange = vi.fn()
    render(<TraitPicker traits={traits} selected={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Neat' }))
    expect(onChange).toHaveBeenCalledWith(['neat'])
  })

  it('deselects a trait when it is clicked again', () => {
    const onChange = vi.fn()
    render(<TraitPicker traits={traits} selected={['neat']} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Neat' }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('disables conflicting traits when their conflict partner is selected', () => {
    render(<TraitPicker traits={traits} selected={['neat']} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Slob' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bookworm' })).not.toBeDisabled()
  })

  it('does not disable a trait that has no conflict with selected', () => {
    render(<TraitPicker traits={traits} selected={['neat']} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Good' })).not.toBeDisabled()
  })

  it('disables all traits once max is reached', () => {
    render(
      <TraitPicker
        traits={traits}
        selected={['neat', 'good', 'bookworm']}
        onChange={vi.fn()}
        max={3}
      />
    )
    expect(screen.getByRole('button', { name: 'Evil' })).toBeDisabled()
  })

  it('filters traits by category tab', () => {
    render(<TraitPicker traits={traits} selected={[]} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hobby' }))
    expect(screen.getByRole('button', { name: 'Bookworm' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Neat' })).not.toBeInTheDocument()
  })
})
