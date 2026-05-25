// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { SectionNav } from '../section-nav/section-nav'
import type { SectionNavItem } from '../section-nav/section-nav'

// ---------------------------------------------------------------------------
// IntersectionObserver mock — captures the callback so the test can drive it.
// ---------------------------------------------------------------------------

type IOCallback = (entries: Array<Partial<IntersectionObserverEntry>>) => void

let ioCallback: IOCallback | null = null
const observeSpy = vi.fn()
const disconnectSpy = vi.fn()

class MockIntersectionObserver {
  constructor(cb: IOCallback) {
    ioCallback = cb
  }
  observe = observeSpy
  unobserve = vi.fn()
  disconnect = disconnectSpy
  takeRecords = vi.fn()
  root = null
  rootMargin = ''
  thresholds = []
}

const items: SectionNavItem[] = [
  { id: 'hero', label: 'Chronicle' },
  { id: 'succession', label: 'Succession' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'sims', label: 'Family' },
]

/** Build a stub element with a known bounding rect + id. */
function stubEl(id: string, top: number): HTMLElement {
  const el = { id, getBoundingClientRect: () => ({ top }) } as unknown as HTMLElement
  return el
}

/** Fire the IO callback with the given section as the highest-ratio entry. */
function fireSectionVisible(id: string, ratio: number) {
  if (!ioCallback) throw new Error('IntersectionObserver callback not captured')
  act(() => {
    ioCallback!([{ target: { id } as Element, isIntersecting: true, intersectionRatio: ratio }])
  })
}

describe('SectionNav', () => {
  let scrollToSpy: ReturnType<typeof vi.fn>
  let getByIdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    ioCallback = null
    observeSpy.mockClear()
    disconnectSpy.mockClear()
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

    scrollToSpy = vi.fn()
    vi.stubGlobal('scrollTo', scrollToSpy)
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true })

    // Map ids to stub elements with distinct getBoundingClientRect tops.
    const els: Record<string, HTMLElement> = {
      hero: stubEl('hero', 0),
      succession: stubEl('succession', 300),
      milestones: stubEl('milestones', 600),
      sims: stubEl('sims', 900),
    }
    getByIdSpy = vi
      .spyOn(document, 'getElementById')
      .mockImplementation((id: string) => els[id] ?? null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    getByIdSpy.mockRestore()
  })

  it('renders a nav with all items as buttons', () => {
    render(<SectionNav items={items} />)
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument()
    for (const item of items) {
      expect(screen.getByRole('button', { name: item.label })).toBeInTheDocument()
    }
    // It observes every section element on mount.
    expect(observeSpy).toHaveBeenCalledTimes(items.length)
  })

  it('smooth-scrolls the window when an item is clicked', () => {
    render(<SectionNav items={items} />)
    fireEvent.click(screen.getByRole('button', { name: 'Milestones' }))
    // top = boundingRect.top (600) + scrollY (100) - 56 = 644
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 644, behavior: 'smooth' })
  })

  it('marks the highest-ratio intersecting section as aria-current', () => {
    render(<SectionNav items={items} />)

    // Initially nothing is active.
    expect(screen.getByRole('button', { name: 'Chronicle' })).not.toHaveAttribute(
      'aria-current',
    )

    fireSectionVisible('succession', 0.8)
    expect(screen.getByRole('button', { name: 'Succession' })).toHaveAttribute(
      'aria-current',
      'true',
    )

    // A new section with a higher ratio wins.
    fireSectionVisible('milestones', 0.95)
    expect(screen.getByRole('button', { name: 'Milestones' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Succession' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('disconnects the observer on unmount', () => {
    const { unmount } = render(<SectionNav items={items} />)
    unmount()
    expect(disconnectSpy).toHaveBeenCalled()
  })
})
