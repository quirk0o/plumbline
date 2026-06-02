import {
  Eyebrow,
  StatBlock,
  PortraitAvatar,
  GhostCircle,
  ButtonLink,
  UserPlusIcon,
  ArrowRightIcon,
} from '@/components/ui'
import { roman } from '@/lib/legacy-format'
import type { ChronicleSim, LegacyStats } from '../../lib/types'
import { splitLegacyName } from '../../lib/legacy-title'
import styles from './hero.module.css'

// ---------------------------------------------------------------------------
// NowThenColumn — a filled founder/heir column
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
// FounderGhost — empty founder slot with an "Add your founder" CTA
// ---------------------------------------------------------------------------

function FounderGhost({ slug }: { slug: string }) {
  return (
    <div className={styles.nowThenColumn}>
      <Eyebrow color="var(--amber-text)">Founder · Gen I</Eyebrow>
      <GhostCircle size={96} accent>
        <UserPlusIcon size={22} />
      </GhostCircle>
      <div className={styles.nowThenCta}>
        <ButtonLink
          variant="primary"
          size="sm"
          href={`/app/legacies/${slug}/sims/new`}
        >
          Add your founder <ArrowRightIcon size={14} />
        </ButtonLink>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HeirGhost — empty heir slot ("No heir yet")
// ---------------------------------------------------------------------------

function HeirGhost({ accent, hint }: { accent: boolean; hint: string }) {
  return (
    <div className={styles.nowThenColumn}>
      <Eyebrow color={accent ? 'var(--amber-text)' : undefined}>
        Current heir
      </Eyebrow>
      <GhostCircle size={96} accent={accent}>
        <UserPlusIcon size={22} />
      </GhostCircle>
      <div className={styles.nowThenNameBlock}>
        <span className={styles.nowThenNameEmpty}>No heir yet</span>
        <span className={styles.nowThenHint}>{hint}</span>
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

const BRAND_NEW_BLURB =
  'Add your founder to begin — the succession line, the milestones, and the family roster all fill in from here.'

export function Hero({
  name,
  description,
  slug,
  stats,
  founder,
  currentHeir,
  treeSlot,
}: HeroProps) {
  // A legacy with no founder is "brand new": em-dash stats + a dashed card.
  const isBrandNew = founder === null
  const blurb = description ?? (isBrandNew ? BRAND_NEW_BLURB : null)

  return (
    <div className={styles.grid}>
      {/* LEFT — chronicle info */}
      <div className={styles.left}>
        <Eyebrow>Legacy · Chronicle</Eyebrow>
        <LegacyTitle name={name} />
        {blurb && <p className={styles.blurb}>{blurb}</p>}

        <div className={styles.statRow}>
          {isBrandNew ? (
            <>
              <StatBlock value="—" label="Sims" accent="var(--text-subtle)" />
              <StatBlock
                value="—"
                label="Generations"
                accent="var(--text-subtle)"
              />
              <StatBlock
                value="—"
                label="Households"
                accent="var(--text-subtle)"
              />
              <StatBlock
                value="—"
                label="Milestones"
                accent="var(--text-subtle)"
              />
            </>
          ) : (
            <>
              <StatBlock value={stats.sims} label="Sims" />
              <StatBlock
                value={stats.generations}
                label="Generations"
                accent="var(--amber-text)"
              />
              <StatBlock value={stats.households} label="Households" />
              <StatBlock value={stats.milestones} label="Milestones" />
            </>
          )}
        </div>

        {treeSlot && <div className={styles.buttonRow}>{treeSlot}</div>}
      </div>

      {/* RIGHT — Now & then card (always rendered) */}
      <div className={styles.right}>
        <Eyebrow>Now &amp; then</Eyebrow>
        <div
          className={isBrandNew ? styles.nowThenCardEmpty : styles.nowThenCard}
        >
          {founder ? (
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
          ) : (
            <FounderGhost slug={slug} />
          )}

          <div className={styles.nowThenDivider} aria-hidden="true" />

          {currentHeir ? (
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
          ) : (
            <HeirGhost
              accent={!isBrandNew}
              hint={
                isBrandNew
                  ? 'Named once the line begins.'
                  : 'Named when the next generation comes of age.'
              }
            />
          )}
        </div>
      </div>
    </div>
  )
}
