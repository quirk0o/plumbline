'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui'
import styles from './challenge-search.module.css'

const DEBOUNCE_MS = 300

/**
 * Search box for the challenges list. Keeps its own input state for smooth
 * typing and debounces into `router.replace`, so the query lives in the URL
 * (shareable) and the server re-filters. Preserves other params (tab).
 */
export function ChallengeSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [value, setValue] = useState(urlQuery)
  const [, startTransition] = useTransition()
  const lastPushed = useRef(urlQuery)

  // External URL change (Back/forward, link nav) → adopt it into the input
  // rather than re-pushing the stale local value and fighting the user.
  useEffect(() => {
    if (urlQuery !== lastPushed.current) {
      lastPushed.current = urlQuery
      setValue(urlQuery)
    }
  }, [urlQuery])

  useEffect(() => {
    // The URL settles on the trimmed query; the visible input keeps the raw
    // value the user typed. Comparing and pushing the trimmed form lets local
    // state and the URL converge — e.g. whitespace-only deletes `q`, so
    // trimmed '' === urlQuery '' and the effect stops re-arming — instead of
    // re-issuing router.replace every debounce window.
    const trimmed = value.trim()
    if (trimmed === urlQuery) return
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (trimmed) params.set('q', trimmed)
      else params.delete('q')
      const qs = params.toString()
      lastPushed.current = trimmed
      startTransition(() => {
        router.replace(qs ? `/app/challenges?${qs}` : '/app/challenges', { scroll: false })
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [value, urlQuery, searchParams, router])

  return (
    <Input
      type="search"
      className={styles.input}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder="Search challenges…"
      aria-label="Search challenges"
    />
  )
}
