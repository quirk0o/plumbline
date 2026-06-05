'use client'

import { useState } from 'react'
import type { LifeStage } from '@prisma/client'
import styles from './trait-picker.module.css'

export interface Trait {
  id: string
  name: string
  category: string | null
  minLifeStage: LifeStage | null
  maxLifeStage: LifeStage | null
  conflictsWith: string[]
}

interface TraitPickerProps {
  traits: Trait[]
  selected: string[]
  onChange: (ids: string[]) => void
  max?: number
  scrollableGrid?: boolean
}

const CATEGORIES = ['All', 'Emotional', 'Hobby', 'Lifestyle', 'Social'] as const

export function TraitPicker({ traits, selected, onChange, max = 6, scrollableGrid = false }: TraitPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [search, setSearch] = useState('')

  const conflictedIds = new Set(
    selected.flatMap((id) => traits.find((t) => t.id === id)?.conflictsWith ?? [])
  )

  const visible = traits.filter((t) => {
    if (activeCategory !== 'All' && t.category !== activeCategory.toUpperCase()) return false
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else if (!conflictedIds.has(id) && selected.length < max) {
      onChange([...selected, id])
    }
  }

  function conflictingWithLabel(id: string): string | undefined {
    if (!conflictedIds.has(id)) return undefined
    const conflictingSelected = selected.find((selId) => {
      const t = traits.find((x) => x.id === selId)
      return t?.conflictsWith.includes(id)
    })
    return traits.find((t) => t.id === conflictingSelected)?.name
  }

  return (
    <div className={`${styles.container} ${scrollableGrid ? styles.containerScrollable : ''}`}>
      <div className={styles.chips} aria-live="polite">
        {selected.map((id) => {
          const trait = traits.find((t) => t.id === id)
          if (!trait) return null
          return (
            <button
              key={id}
              type="button"
              className={styles.chip}
              onClick={() => toggle(id)}
              aria-label={`Remove ${trait.name}`}
            >
              {trait.name} <span aria-hidden="true">✕</span>
            </button>
          )
        })}
        {selected.length === 0 && <span className={styles.emptyChips}>No traits selected</span>}
      </div>

      <div className={styles.tabs}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={activeCategory === cat}
            className={`${styles.tab} ${activeCategory === cat ? styles.tabActive : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder="Search traits…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={styles.search}
      />

      <div className={scrollableGrid ? styles.gridScroll : undefined}>
        <div className={styles.grid}>
          {visible.map((trait) => {
            const isSelected = selected.includes(trait.id)
            const isConflicted = conflictedIds.has(trait.id)
            const isCapped = !isSelected && selected.length >= max
            const isDisabled = isConflicted || isCapped

            return (
              <button
                key={trait.id}
                type="button"
                className={`${styles.traitBtn} ${isSelected ? styles.traitSelected : ''} ${isDisabled ? styles.traitDisabled : ''}`}
                onClick={() => toggle(trait.id)}
                disabled={isDisabled}
                title={isConflicted ? `Conflicts with ${conflictingWithLabel(trait.id)}` : undefined}
                aria-pressed={isSelected}
              >
                {trait.name}
              </button>
            )
          })}
          {visible.length === 0 && <p className={styles.noResults}>No traits match</p>}
        </div>
      </div>

      <p className={styles.counter}>
        {selected.length} / {max} traits selected
      </p>
    </div>
  )
}
