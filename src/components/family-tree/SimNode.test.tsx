// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SimNode } from './SimNode'
import type { SimNodeType } from './SimNode'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next/image', () => ({
  default: (props: { alt: string }) => <span role="img" aria-label={props.alt} />,
}))

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom' },
}))

function makeNodeProps(overrides: Partial<SimNodeType['data']> = {}): Parameters<typeof SimNode>[0] {
  const data: SimNodeType['data'] = {
    id: 'sim-1',
    firstName: 'Mortimer',
    lastName: 'Goth',
    imageUrl: null,
    generationNumber: 1,
    isFocused: false,
    href: '/app/legacies/goth-dynasty/sims/sim-1',
    ...overrides,
  }
  return {
    data,
    id: data.id,
    type: 'simNode',
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    selectable: false,
    deletable: false,
    selected: false,
    draggable: false,
  }
}

describe('SimNode', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  it("renders the sim's full name", () => {
    render(<SimNode {...makeNodeProps()} />)
    expect(screen.getByText('Mortimer Goth')).toBeInTheDocument()
  })

  it('renders initials fallback when imageUrl is absent', () => {
    render(<SimNode {...makeNodeProps({ imageUrl: null })} />)
    expect(screen.getByText('MG')).toBeInTheDocument()
  })

  it('renders initials fallback when imageUrl is empty string', () => {
    render(<SimNode {...makeNodeProps({ imageUrl: '' })} />)
    expect(screen.getByText('MG')).toBeInTheDocument()
  })

  it('renders "?" as initials when firstName and lastName are empty', () => {
    render(<SimNode {...makeNodeProps({ firstName: '', lastName: '' })} />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('navigates to data.href when the node is clicked', () => {
    render(<SimNode {...makeNodeProps()} />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockPush).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth-dynasty/sims/sim-1')
  })

  it('navigates to data.href when Enter is pressed', () => {
    render(<SimNode {...makeNodeProps()} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(mockPush).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth-dynasty/sims/sim-1')
  })

  it('navigates to data.href when Space is pressed', () => {
    render(<SimNode {...makeNodeProps()} />)
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(mockPush).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth-dynasty/sims/sim-1')
  })

  it('applies focused CSS class when data.isFocused is true', () => {
    const { container } = render(<SimNode {...makeNodeProps({ isFocused: true })} />)
    const node = container.querySelector('[role="button"]')
    expect(node?.className).toMatch(/focused/)
  })

  it('does not apply focused CSS class when data.isFocused is false', () => {
    const { container } = render(<SimNode {...makeNodeProps({ isFocused: false })} />)
    const node = container.querySelector('[role="button"]')
    expect(node?.className).not.toMatch(/focused/)
  })
})
