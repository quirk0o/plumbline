import { Button, PortraitAvatar, HouseIcon, ArrowRightIcon } from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import { roman } from '@/lib/legacy-format'
import type { HouseholdView, HouseholdSim } from '../../lib/types'
import { simoleons } from './lib'
import styles from './households.module.css'

function ringFor(sim: HouseholdSim): 'founder' | 'heir' | 'green' {
  return sim.isHeir ? 'heir' : sim.isFounder ? 'founder' : 'green'
}

export function NowPlayingPill() {
  return (
    <span className={styles.nowPlaying}>
      <Plumbob size={9} glow />
      Now playing
    </span>
  )
}

export function LotLine({ household }: { household: HouseholdView }) {
  if (!household.worldName && !household.lot) return null
  return (
    <span className={styles.lotLine}>
      <HouseIcon size={13} />
      <span>{[household.worldName, household.lot].filter(Boolean).join(' · ')}</span>
    </span>
  )
}

export function ResidentStack({
  residents,
  size = 34,
  max = 5,
}: {
  residents: HouseholdSim[]
  size?: number
  max?: number
}) {
  const shown = residents.slice(0, max)
  const extra = residents.length - shown.length
  return (
    <div className={styles.stack}>
      {shown.map((r) => (
        <div key={r.id} className={styles.stackItem} title={`${r.firstName} ${r.lastName}`}>
          <PortraitAvatar
            imageUrl={r.imageUrl}
            firstName={r.firstName}
            lastName={r.lastName}
            size={size}
            ring={ringFor(r)}
          />
        </div>
      ))}
      {extra > 0 && (
        <div className={styles.stackOverflow} style={{ width: size, height: size }}>
          +{extra}
        </div>
      )}
    </div>
  )
}

export interface FeaturedHouseholdProps {
  household: HouseholdView
  onManage: () => void
}

/** The large "now playing" card: identity + residents on the left, a
 *  parchment stat rail with the manage CTA on the right. */
export function FeaturedHousehold({ household: h, onManage }: FeaturedHouseholdProps) {
  return (
    <div className={styles.featured}>
      <div className={styles.featuredMain}>
        <div className={styles.featuredTopRow}>
          <NowPlayingPill />
          <LotLine household={h} />
        </div>
        <div>
          <h3 className={styles.featuredName}>{h.name}</h3>
          {h.description && <p className={styles.featuredBlurb}>{h.description}</p>}
        </div>
        {h.residents.length > 0 && (
          <div className={styles.featuredResidents}>
            <ResidentStack residents={h.residents} size={40} />
            <span className={styles.featuredResidentNames}>
              {h.residents.map((r) => r.firstName).join(' · ')}
            </span>
          </div>
        )}
      </div>

      <div className={styles.featuredRail}>
        <div className={styles.railStats}>
          <div className={styles.railStat}>
            <span className={`${styles.railStatValue} ${styles.railStatGreen}`}>
              {simoleons(h.funds)}
            </span>
            <span className={styles.railStatLabel}>Household funds</span>
          </div>
          <div className={styles.railStat}>
            <span className={styles.railStatValue}>{h.residents.length}</span>
            <span className={styles.railStatLabel}>Residents</span>
          </div>
          <div className={styles.railStat}>
            <span className={styles.railStatValue}>{simoleons(h.lotValue)}</span>
            <span className={styles.railStatLabel}>Lot value</span>
          </div>
          {h.foundedGeneration !== null && (
            <div className={styles.railStat}>
              <span className={`${styles.railStatValue} ${styles.railStatAmber}`}>
                Gen {roman(h.foundedGeneration)}
              </span>
              <span className={styles.railStatLabel}>Founded</span>
            </div>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className={styles.manageButton} onClick={onManage}>
          Manage household <ArrowRightIcon size={15} />
        </Button>
      </div>
    </div>
  )
}
