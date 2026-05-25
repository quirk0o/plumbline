import {
  Breadcrumb,
  Eyebrow,
  StatBlock,
  PortraitAvatar,
} from '@/components/ui'
import { roman } from '@/lib/legacy-format'
import type { ChronicleSim, LegacyStats } from '../../lib/types'
import styles from './hero.module.css'

// ---------------------------------------------------------------------------
// NowThenColumn — local sub-component
// ---------------------------------------------------------------------------

interface NowThenColumnProps {
  label: string
  sim: ChronicleSim
  ring: 'founder' | 'heir'
}

function NowThenColumn({ label, sim, ring }: NowThenColumnProps) {
  return (
    <div className={styles.nowThenColumn}>
      <Eyebrow color={ring === 'heir' ? 'var(--color-amber-700)' : undefined}>
        {label}
      </Eyebrow>
      <PortraitAvatar
        imageUrl={sim.imageUrl}
        firstName={sim.firstName}
        lastName={sim.lastName}
        size={96}
        ring={ring}
      />
      <div className={styles.nowThenNameBlock}>
        <span className={styles.nowThenName}>
          {sim.firstName} {sim.lastName}
        </span>
        {sim.aspirationName && (
          <span className={styles.nowThenAspiration}>{sim.aspirationName}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hero — exported section component
// ---------------------------------------------------------------------------

export interface HeroProps {
  name: string
  description: string | null
  stats: LegacyStats
  founder: ChronicleSim | null
  currentHeir: ChronicleSim | null
  treeSlot?: React.ReactNode
}

/**
 * Renders the name with the trailing word "Legacy" in amber `<em>` if present.
 */
function LegacyTitle({ name }: { name: string }) {
  const trailingLegacy = /^(.*)\s(Legacy)$/
  const match = name.match(trailingLegacy)
  if (match) {
    return (
      <h1 className={styles.title}>
        {match[1]} <em className={styles.titleAccent}>{match[2]}</em>
      </h1>
    )
  }
  return <h1 className={styles.title}>{name}</h1>
}

export function Hero({
  name,
  description,
  stats,
  founder,
  currentHeir,
  treeSlot,
}: HeroProps) {
  const showCard = founder !== null || currentHeir !== null

  return (
    <div className={styles.grid}>
      {/* LEFT — chronicle info */}
      <div className={styles.left}>
        <Breadcrumb
          items={[{ label: 'Dashboard', href: '/app' }, { label: name }]}
          className={styles.breadcrumb}
        />
        <Eyebrow>Legacy · Chronicle</Eyebrow>
        <LegacyTitle name={name} />
        {description && <p className={styles.blurb}>{description}</p>}

        <div className={styles.statRow}>
          <StatBlock value={stats.sims} label="Sims" />
          <StatBlock
            value={stats.generations}
            label="Generations"
            accent="var(--color-amber-700)"
          />
          <StatBlock value={stats.households} label="Households" />
          <StatBlock value={stats.milestones} label="Milestones" />
        </div>

        {treeSlot && <div className={styles.buttonRow}>{treeSlot}</div>}
      </div>

      {/* RIGHT — Now & then card */}
      {showCard && (
        <div className={styles.right}>
          <Eyebrow>Now &amp; then</Eyebrow>
          <div className={styles.nowThenCard}>
            {founder && (
              <NowThenColumn
                label={
                  founder.generationNumber !== null
                    ? `Founder · Gen ${roman(founder.generationNumber)}`
                    : 'Founder'
                }
                sim={founder}
                ring="founder"
              />
            )}
            {founder && currentHeir && (
              <div className={styles.nowThenDivider} aria-hidden="true" />
            )}
            {currentHeir && (
              <NowThenColumn
                label={
                  currentHeir.generationNumber !== null
                    ? `Current heir · Gen ${roman(currentHeir.generationNumber)}`
                    : 'Current heir'
                }
                sim={currentHeir}
                ring="heir"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
