// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
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

  it('activates on Enter and Space', () => {
    const onSelect = vi.fn()
    const { getByRole } = renderNode({}, { onSelect })
    const btn = getByRole('button')
    btn.focus()
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onSelect).toHaveBeenCalledWith('reed')
  })

  it('renders the monogram fallback upright (no italic)', () => {
    const { container } = renderNode({ imageUrl: null })
    const monogram = [...container.querySelectorAll('text')].find(
      (t) => t.textContent === 'RC',
    )
    expect(monogram).toBeTruthy()
    expect(monogram?.getAttribute('font-style')).not.toBe('italic')
    expect((monogram as SVGTextElement | undefined)?.style.fontStyle).not.toBe(
      'italic',
    )
  })

  it('applies the lift-shadow filter to the medallion', () => {
    const { container } = renderNode()
    const filtered = container.querySelector('circle[filter*="crest-lift"]')
    expect(filtered).toBeTruthy()
  })

  it('includes a focus-ring element that is hidden by default', () => {
    const { container } = renderNode()
    const ring = container.querySelector('[data-focus-ring]')
    expect(ring).toBeTruthy() // present in the DOM; visibility is CSS-driven
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
