import { Eyebrow, StatBlock, PortraitAvatar } from '@/components/ui'
import { roman } from '@/lib/legacy-format'
import type { ChronicleSim, LegacyStats } from '../../lib/types'
import { splitLegacyName } from '../../lib/legacy-title'
import styles from './hero.module.css'

// ---------------------------------------------------------------------------
// NowThenColumn — local sub-component
// ---------------------------------------------------------------------------

interface NowThenColumnProps {
  label: string
  sim: ChronicleSim
  ring: 'founder' | 'heir'
  href: string
}

function NowThenColumn({ label, sim, ring, href }: NowThenColumnProps) {
  return (
    <div className={styles.nowThenColumn}>
      <Eyebrow color={ring === 'heir' ? 'var(--amber-text)' : undefined}>
        {label}
      </Eyebrow>
      <PortraitAvatar
        imageUrl={sim.imageUrl}
        firstName={sim.firstName}
        lastName={sim.lastName}
        size={96}
        ring={ring}
        href={href}
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
  slug: string
  stats: LegacyStats
  founder: ChronicleSim | null
  currentHeir: ChronicleSim | null
  treeSlot?: React.ReactNode
}

/**
 * Renders the name with the trailing word "Legacy" in amber `<em>` if present.
 */
function LegacyTitle({ name }: { name: string }) {
  const parts = splitLegacyName(name)
  if (parts) {
    return (
      <h1 className={styles.title}>
        {parts.before} <em className={styles.titleAccent}>{parts.legacy}</em>
      </h1>
    )
  }
  return <h1 className={styles.title}>{name}</h1>
}

export function Hero({
  name,
  description,
  slug,
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
        <Eyebrow>Legacy · Chronicle</Eyebrow>
        <LegacyTitle name={name} />
        {description && <p className={styles.blurb}>{description}</p>}

        <div className={styles.statRow}>
          <StatBlock value={stats.sims} label="Sims" />
          <StatBlock
            value={stats.generations}
            label="Generations"
            accent="var(--amber-text)"
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
                href={`/app/legacies/${slug}/sims/${founder.id}`}
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
                href={`/app/legacies/${slug}/sims/${currentHeir.id}`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
