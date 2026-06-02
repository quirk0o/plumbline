'use client'
import { ButtonLink } from '@/components/ui'
import { roman } from '@/lib/legacy-format'
import { cn } from '@/lib/utils'
import styles from './atlas-toolbar.module.css'

export type GenFilter = number | 'all'

export interface AtlasToolbarProps {
  legacySlug: string
  /** Distinct generation numbers present, ascending. */
  generations: number[]
  genFilter: GenFilter
  query: string
  onGenChange: (gen: GenFilter) => void
  onQueryChange: (query: string) => void
}

export function AtlasToolbar({
  legacySlug,
  generations,
  genFilter,
  query,
  onGenChange,
  onQueryChange,
}: AtlasToolbarProps) {
  const pills: { key: string; label: string; value: GenFilter }[] = [
    { key: 'all', label: 'All', value: 'all' },
    ...generations.map((g) => ({ key: String(g), label: `Gen ${roman(g)}`, value: g })),
  ]

  return (
    <div className={styles.toolbar}>
      <div className={styles.searchWrap}>
        <svg
          className={styles.searchIcon}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <circle cx="6" cy="6" r="4.5" />
          <path d="M9.5 9.5L13 13" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search this lineage…"
          aria-label="Search this lineage"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>

      <span className={styles.divider} aria-hidden="true" />

      <div className={styles.pills} role="group" aria-label="Filter by generation">
        {pills.map((pill) => {
          const active = pill.value === genFilter
          return (
            <button
              key={pill.key}
              type="button"
              className={cn(styles.pill, active && styles.pillActive)}
              aria-pressed={active}
              onClick={() => onGenChange(pill.value)}
            >
              {pill.label}
            </button>
          )
        })}
      </div>

      <span className={styles.divider} aria-hidden="true" />

      <ButtonLink href={`/app/legacies/${legacySlug}/sims/new`} variant="primary" size="sm">
        Add sim
      </ButtonLink>
    </div>
  )
}
