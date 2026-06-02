'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import styles from './section-nav.module.css'

export interface SectionNavItem {
  id: string
  label: string
}

export interface SectionNavProps {
  items: SectionNavItem[]
}

/**
 * Sticky left-rail navigation with scroll-spy.
 *
 * The page scrolls normally (the AppNav lives in the app layout), so the
 * IntersectionObserver watches the document viewport (`root: null`). The
 * active item is the intersecting section with the highest intersectionRatio.
 *
 * Clicking an item smooth-scrolls the WINDOW (never `scrollIntoView`, which
 * interferes with the app shell). Active state is always derived from the
 * observer, not from the click.
 */
export function SectionNav({ items }: SectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  // Keep the per-section ratios so we can always pick the highest one.
  const ratios = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    // Reset accumulated ratios so a re-observe (e.g. items change) never keeps
    // stale section ids that could win the highest-ratio comparison.
    ratios.current.clear()

    function recompute() {
      // The observer's bottom rootMargin means a short final section near the
      // page bottom can never reach the active band. When the page is scrolled
      // to the bottom, force the last item active so it's always reachable.
      const docEl = document.documentElement
      const scrollable = docEl.scrollHeight > window.innerHeight + 4
      const atBottom =
        window.innerHeight + window.scrollY >= docEl.scrollHeight - 2
      if (scrollable && atBottom && items.length > 0) {
        setActiveId(items[items.length - 1].id)
        return
      }

      let bestId: string | null = null
      let bestRatio = 0
      for (const [id, ratio] of ratios.current) {
        if (ratio > bestRatio) {
          bestRatio = ratio
          bestId = id
        }
      }
      if (bestId !== null) setActiveId(bestId)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (!id) continue
          ratios.current.set(id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        recompute()
      },
      {
        root: null,
        rootMargin: '-72px 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    for (const item of items) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }

    // A passive scroll listener (rAF-throttled) catches the bottom-of-page case,
    // which the IntersectionObserver alone cannot resolve for short sections.
    let frame = 0
    function onScroll() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        recompute()
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [items])

  function handleClick(id: string) {
    const el = document.getElementById(id)
    if (el) {
      const prefersReduced = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 56,
        behavior: prefersReduced ? 'auto' : 'smooth',
      })
    }
  }

  return (
    <nav aria-label="Sections" className={styles.rail}>
      {items.map((item) => {
        const isActive = activeId === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleClick(item.id)}
            aria-current={isActive ? 'location' : undefined}
            className={cn(styles.item, isActive && styles.itemActive)}
          >
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
