// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrestNode, type CrestNodeSim } from '../crest-node'

const base: CrestNodeSim = {
  id: 'reed',
  firstName: 'Reed',
  lastName: 'Caliente',
  imageUrl: null,
  lifeStage: 'TEEN',
}

function renderNode(
  simOverrides: Partial<CrestNodeSim> = {},
  props: { onSelect?: (id: string) => void; liftFilterId?: string } = {},
) {
  return render(
    <svg>
      <CrestNode
        sim={{ ...base, ...simOverrides }}
        x={10}
        y={20}
        isHeir
        plumbobGradientId="plumbob"
        liftFilterId="crest-lift"
        onSelect={props.onSelect ?? (() => {})}
        {...props}
      />
    </svg>,
  )
}

describe('CrestNode', () => {
  it('renders as a button whose accessible name includes the life stage', () => {
    const { getByRole } = renderNode()
    const btn = getByRole('button', { name: /Reed Caliente.*Teen/ })
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('tabindex')).toBe('0')
  })

  it('activates on Enter and Space', async () => {
    const onSelect = vi.fn()
    const { getByRole } = renderNode({}, { onSelect })
    getByRole('button').focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onSelect).toHaveBeenCalledWith('reed')
  })

  it('renders the monogram fallback in italic display-serif', () => {
    const { container } = renderNode({ imageUrl: null })
    const monogram = [...container.querySelectorAll('text')].find(
      (t) => t.textContent === 'RC',
    )
    expect(monogram).toBeTruthy()
    expect(monogram?.getAttribute('font-style')).toBe('italic')
  })

  it('is not interactive (no button role) when onSelect is omitted', () => {
    const { queryByRole } = render(
      <svg>
        <CrestNode sim={base} x={0} y={0} plumbobGradientId="plumbob" />
      </svg>,
    )
    expect(queryByRole('button')).toBeNull()
  })
})
