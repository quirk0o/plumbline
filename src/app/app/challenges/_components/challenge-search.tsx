'use client'

import { useEffect, useState, useTransition } from 'react'
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

  useEffect(() => {
    if (value === urlQuery) return
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value.trim()) params.set('q', value)
      else params.delete('q')
      const qs = params.toString()
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
