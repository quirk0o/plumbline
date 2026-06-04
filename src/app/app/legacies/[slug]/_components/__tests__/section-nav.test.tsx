// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SectionNav } from '../section-nav/section-nav'
import type { SectionNavItem } from '../section-nav/section-nav'

// ---------------------------------------------------------------------------
// IntersectionObserver mock — captures the callback so the test can drive it.
// ---------------------------------------------------------------------------

type IOCallback = (entries: Array<Partial<IntersectionObserverEntry>>) => void

let ioCallback: IOCallback | null = null

class MockIntersectionObserver {
  constructor(cb: IOCallback) {
    ioCallback = cb
  }
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
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

/** Fire the IO callback marking a section as having left the viewport. */
function fireSectionExit(id: string) {
  if (!ioCallback) throw new Error('IntersectionObserver callback not captured')
  act(() => {
    ioCallback!([{ target: { id } as Element, isIntersecting: false, intersectionRatio: 0 }])
  })
}

describe('SectionNav', () => {
  let scrollToSpy: ReturnType<typeof vi.fn>
  let getByIdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    ioCallback = null
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

    scrollToSpy = vi.fn()
    vi.stubGlobal('scrollTo', scrollToSpy)
    Object.defineProperty(window, 'scrollY', { value: 100, configurable: true })

    // jsdom has no matchMedia; default to "motion allowed" (matches: false).
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: false } as MediaQueryList),
    )

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
  })

  it('smooth-scrolls the window when an item is clicked', async () => {
    const user = userEvent.setup()
    render(<SectionNav items={items} />)
    await user.click(screen.getByRole('button', { name: 'Milestones' }))
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth', top: expect.any(Number) }),
    )
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
      'location',
    )

    // A new section with a higher ratio wins.
    fireSectionVisible('milestones', 0.95)
    expect(screen.getByRole('button', { name: 'Milestones' })).toHaveAttribute(
      'aria-current',
      'location',
    )
    expect(screen.getByRole('button', { name: 'Succession' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('transfers aria-current when the active section leaves and another enters', () => {
    render(<SectionNav items={items} />)

    fireSectionVisible('succession', 0.8)
    expect(screen.getByRole('button', { name: 'Succession' })).toHaveAttribute(
      'aria-current',
      'location',
    )

    // Succession scrolls out (ratio 0) and milestones becomes the visible one.
    fireSectionExit('succession')
    fireSectionVisible('milestones', 0.4)
    expect(screen.getByRole('button', { name: 'Milestones' })).toHaveAttribute(
      'aria-current',
      'location',
    )
    expect(screen.getByRole('button', { name: 'Succession' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('forces the last item active when the page is scrolled to the bottom', () => {
    // Make the document scrollable and positioned at the very bottom.
    Object.defineProperty(window, 'innerHeight', { value: 720, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: 800, configurable: true })
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 1520,
      configurable: true,
    })

    render(<SectionNav items={items} />)

    // Even though Milestones reports the highest ratio, being at the bottom
    // must activate the last item (Family/sims) so it is reachable.
    fireSectionVisible('milestones', 0.9)
    expect(screen.getByRole('button', { name: 'Family' })).toHaveAttribute(
      'aria-current',
      'location',
    )
    expect(screen.getByRole('button', { name: 'Milestones' })).not.toHaveAttribute(
      'aria-current',
    )
  })
})
