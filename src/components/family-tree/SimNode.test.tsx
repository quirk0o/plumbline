// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('navigates to data.href when the node is clicked', async () => {
    const user = userEvent.setup()
    render(<SimNode {...makeNodeProps()} />)
    await user.click(screen.getByRole('button'))
    expect(mockPush).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth-dynasty/sims/sim-1')
  })

  it('navigates to data.href when Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<SimNode {...makeNodeProps()} />)
    screen.getByRole('button').focus()
    await user.keyboard('{Enter}')
    expect(mockPush).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth-dynasty/sims/sim-1')
  })

  it('navigates to data.href when Space is pressed', async () => {
    const user = userEvent.setup()
    render(<SimNode {...makeNodeProps()} />)
    screen.getByRole('button').focus()
    await user.keyboard(' ')
    expect(mockPush).toHaveBeenCalledOnce()
    expect(mockPush).toHaveBeenCalledWith('/app/legacies/goth-dynasty/sims/sim-1')
  })

  it('marks the node as current when data.isFocused is true', () => {
    render(<SimNode {...makeNodeProps({ isFocused: true })} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'location')
  })

  it('does not mark the node as current when data.isFocused is false', () => {
    render(<SimNode {...makeNodeProps({ isFocused: false })} />)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-current')
  })
})
