// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import { CrestFlowNode } from '../crest-flow-node'
import type { CrestNodeData, LineageFlowSim } from '../to-flow-graph'

const sim: LineageFlowSim = {
  id: 's1',
  firstName: 'Reed',
  lastName: 'Caliente',
  imageUrl: null,
  generationNumber: 2,
  lifeStage: 'TEEN',
  isHeir: false,
  isDeceased: false,
  gender: 'FEMALE',
}

const data = (overrides: Partial<CrestNodeData> = {}): CrestNodeData => ({
  sim,
  isFounder: false,
  isSelected: false,
  isDimmed: false,
  isFocused: false,
  ...overrides,
})

// Handles need a ReactFlow store; the node itself renders fine inside a bare provider.
function renderNode(d: CrestNodeData) {
  return render(
    <ReactFlowProvider>
      <CrestFlowNode data={d} />
    </ReactFlowProvider>,
  )
}

describe('CrestFlowNode', () => {
  it('renders as a button whose accessible name includes the life stage', () => {
    renderNode(data({ onSelect: vi.fn() }))
    expect(screen.getByRole('button', { name: 'Reed Caliente, Teen' })).toBeInTheDocument()
  })

  it('activates on click, Enter, and Space', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    renderNode(data({ onSelect }))
    const button = screen.getByRole('button', { name: /Reed Caliente/ })
    await user.click(button)
    button.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(3)
    expect(onSelect).toHaveBeenCalledWith('s1')
  })

  it('renders the monogram fallback when the sim has no portrait', () => {
    renderNode(data({ onSelect: vi.fn() }))
    expect(screen.getByText('RC')).toBeInTheDocument()
  })

  it('is not interactive (no button role) when onSelect is omitted', () => {
    renderNode(data())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // Still exposes the sim's name to assistive tech.
    expect(screen.getByText('Reed Caliente')).toBeInTheDocument()
  })

  it('marks the focused sim with aria-current="location" (mini-tree focus ring)', () => {
    renderNode(data({ onSelect: vi.fn(), isFocused: true }))
    expect(screen.getByRole('button', { name: /Reed Caliente/ })).toHaveAttribute('aria-current', 'location')
  })

  it('fires onNodeFocus when the button receives focus', () => {
    const onNodeFocus = vi.fn()
    renderNode(data({ onSelect: vi.fn(), onNodeFocus }))
    screen.getByRole('button', { name: /Reed Caliente/ }).focus()
    expect(onNodeFocus).toHaveBeenCalledWith('s1')
  })

  it('exposes the dimmed state as a data attribute', () => {
    const { container } = renderNode(data({ isDimmed: true }))
    expect(container.querySelector('[data-tree-node]')).toHaveAttribute('data-dimmed')
  })

  it('shows the heir plumbob crown only for heirs', () => {
    const { rerender } = renderNode(data({ sim: { ...sim, isHeir: true } }))
    expect(screen.getByTestId('heir-crown')).toBeInTheDocument()
    rerender(
      <ReactFlowProvider>
        <CrestFlowNode data={data()} />
      </ReactFlowProvider>,
    )
    expect(screen.queryByTestId('heir-crown')).not.toBeInTheDocument()
  })
})
