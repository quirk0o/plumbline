// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from '../dialog'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

function Simple({ open = true, onOpenChange = vi.fn() }: { open?: boolean; onOpenChange?: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Test dialog</Dialog.Title>
          <Dialog.Description>Subtitle here</Dialog.Description>
          <p>Body content</p>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('renders title and body when open', () => {
    render(<Simple open />)
    expect(screen.getByRole('dialog', { name: 'Test dialog' })).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(screen.getByText('Subtitle here')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(<Simple open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onOpenChange(false) when Escape is pressed', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<Simple open onOpenChange={onOpenChange} />)
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange(false) when Close is clicked', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<Simple open onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
