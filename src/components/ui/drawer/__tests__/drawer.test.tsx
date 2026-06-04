// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Drawer } from '../drawer'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    })),
  })
})

function Simple({ open = true, onOpenChange = vi.fn() }: { open?: boolean; onOpenChange?: (v: boolean) => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay />
        <Drawer.Content side="right" aria-describedby={undefined}>
          <Drawer.Title>Test drawer</Drawer.Title>
          <p>Body content</p>
          <Drawer.Close>Close</Drawer.Close>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  )
}

describe('Drawer', () => {
  it('renders title and body when open', () => {
    render(<Simple open />)
    expect(screen.getByRole('dialog', { name: 'Test drawer' })).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(<Simple open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('calls onOpenChange(false) when Escape is pressed', async () => {
    const onOpenChange = vi.fn()
    render(<Simple open onOpenChange={onOpenChange} />)
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange(false) when Close is clicked', async () => {
    const onOpenChange = vi.fn()
    render(<Simple open onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
