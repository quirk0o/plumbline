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
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (!id) continue
          ratios.current.set(id, entry.isIntersecting ? entry.intersectionRatio : 0)
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

    return () => observer.disconnect()
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
            aria-current={isActive ? 'true' : undefined}
            className={cn(styles.item, isActive && styles.itemActive)}
          >
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
