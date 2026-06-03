'use client'

import { cn } from '@/lib/utils'
import { PortraitAvatar } from '@/components/ui'
import { ringFor } from '../../lib/derive'
import type { ChronicleSim } from '../../lib/types'
import styles from './sim-tag-chips.module.css'

export interface SimTagChipsProps {
  sims: ChronicleSim[]
  value: string[]
  onToggle: (id: string) => void
}

export function SimTagChips({ sims, value, onToggle }: SimTagChipsProps) {
  return (
    <div className={styles.chips}>
      {sims.map((sim) => {
        const selected = value.includes(sim.id)
        return (
          <button
            key={sim.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(sim.id)}
            className={cn(styles.chip, selected && styles.selected)}
          >
            <PortraitAvatar
              imageUrl={sim.imageUrl}
              firstName={sim.firstName}
              lastName={sim.lastName}
              size={20}
              ring={ringFor(sim)}
            />
            <span>
              {sim.firstName} {sim.lastName.charAt(0)}.
            </span>
          </button>
        )
      })}
    </div>
  )
}
