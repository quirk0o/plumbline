'use client'

import { Badge, Combobox, PortraitAvatar, HouseIcon } from '@/components/ui'
import { roman } from '@/lib/legacy-format'
import type { HouseholdView, HouseholdSim } from '../../lib/types'
import styles from './household-drawer.module.css'

/** Sentinel option value for "move out to unhoused" — cannot collide with a cuid. */
const UNHOUSED = '__unhoused__'

const LIFE_STAGE_LABELS: Record<string, string> = {
  NEWBORN: 'Newborn',
  INFANT: 'Infant',
  TODDLER: 'Toddler',
  CHILD: 'Child',
  TEEN: 'Teen',
  YOUNG_ADULT: 'Young Adult',
  ADULT: 'Adult',
  ELDER: 'Elder',
}

function ringFor(sim: HouseholdSim): 'founder' | 'heir' | 'green' {
  return sim.isHeir ? 'heir' : sim.isFounder ? 'founder' : 'green'
}

export interface ResidentRowProps {
  resident: HouseholdSim
  /** All OTHER households (move-to targets). */
  others: HouseholdView[]
  onMoveTo: (toHouseholdId: string | null) => void
}

/** Borderless resident row: portrait · name · derived badge · "Move to…"
 *  chip select. Badges are derived only — Heir from isHeir, Founder from the
 *  legacy founder; everyone else gets none (spec decision). */
export function ResidentRow({ resident, others, onMoveTo }: ResidentRowProps) {
  return (
    <div className={styles.row}>
      <PortraitAvatar
        imageUrl={resident.imageUrl}
        firstName={resident.firstName}
        lastName={resident.lastName}
        size={40}
        ring={ringFor(resident)}
      />
      <div className={styles.rowMain}>
        <div className={styles.rowNameLine}>
          <span className={styles.rowName}>
            {resident.firstName} {resident.lastName}
          </span>
          {resident.isHeir && <Badge variant="warning">Heir</Badge>}
          {!resident.isHeir && resident.isFounder && <Badge variant="neutral">Founder</Badge>}
        </div>
        <span className={styles.rowMeta}>
          {LIFE_STAGE_LABELS[resident.lifeStage] ?? resident.lifeStage}
          {resident.generationNumber !== null && <> · Gen {roman(resident.generationNumber)}</>}
        </span>
      </div>
      <Combobox
        variant="chip"
        value=""
        onChange={(v) => onMoveTo(v === UNHOUSED ? null : v)}
        placeholder="Move to…"
        aria-label={`Move ${resident.firstName} to`}
      >
        {others.map((o) => (
          <Combobox.Item key={o.id} value={o.id} textValue={o.name}>
            <span className={styles.optionRow}>
              <HouseIcon size={12} />
              <span className={styles.optionLabel}>{o.name}</span>
              <span className={styles.optionMeta}>
                {o.residents.length} {o.residents.length === 1 ? 'sim' : 'sims'}
              </span>
            </span>
          </Combobox.Item>
        ))}
        <Combobox.Item value={UNHOUSED} textValue="Unhoused">
          Unhoused
        </Combobox.Item>
      </Combobox>
    </div>
  )
}
