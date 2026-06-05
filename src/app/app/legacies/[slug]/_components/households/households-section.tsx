'use client'

import { useMemo, useState } from 'react'
import {
  Button,
  EmptyState,
  SectionHeading,
  HouseIcon,
  PlusIcon,
  ArrowRightIcon,
} from '@/components/ui'
import type { HouseholdView, HouseholdSim, WorldOption } from '../../lib/types'
import { FeaturedHousehold } from './featured-household'
import { HouseholdCard } from './household-card'
import { FoundHouseholdDialog } from './found-household-dialog'
import { HouseholdDrawer } from './household-drawer'
import styles from './households-section.module.css'

export interface HouseholdsSectionProps {
  legacyId: string
  households: HouseholdView[]
  worlds: WorldOption[]
  /** Every sim in the legacy (housed + unhoused) for the move/founding pickers. */
  sims: HouseholdSim[]
}

/**
 * The Households chronicle section: one featured "now playing" card plus a
 * grid of compact cards. Owns the founding-dialog and management-drawer open
 * state; all data arrives from the server page and every mutation ends in
 * router.refresh() (handled inside the dialog/drawer). The open drawer
 * re-reads its household from refreshed props by id, so it stays consistent
 * and unmounts automatically if the household disappears.
 */
export function HouseholdsSection({ legacyId, households, worlds, sims }: HouseholdsSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [foundedId, setFoundedId] = useState<string | null>(null)
  const [founding, setFounding] = useState(false)

  const featured = households.find((h) => h.isActive) ?? null
  const rest = households.filter((h) => h.id !== featured?.id)
  const openHousehold = households.find((h) => h.id === openId) ?? null

  const homeNames = useMemo(
    () => Object.fromEntries(households.map((h) => [h.id, h.name])),
    [households],
  )

  function handleFounded(id: string) {
    setFounding(false)
    setFoundedId(id)
    setOpenId(id)
  }

  return (
    <div>
      <div className={styles.topRow}>
        <div className={styles.headingWrapper}>
          <SectionHeading
            eyebrow="Where they live"
            title="Households"
            blurb="Every roof the legacy keeps — and who lives under it."
          />
        </div>
        {households.length > 0 && (
          <Button type="button" className={styles.foundButton} onClick={() => setFounding(true)}>
            <PlusIcon size={15} /> Found a household
          </Button>
        )}
      </div>

      {households.length === 0 ? (
        <EmptyState
          icon={<HouseIcon size={24} />}
          title="No households yet"
          action={
            <Button type="button" size="sm" onClick={() => setFounding(true)}>
              Found a household <ArrowRightIcon size={16} />
            </Button>
          }
        >
          Every legacy keeps a roof over someone&apos;s head. Found the first
          household and move your sims in.
        </EmptyState>
      ) : (
        <>
          {featured && (
            <div className={styles.featuredWrap}>
              <FeaturedHousehold household={featured} onManage={() => setOpenId(featured.id)} />
            </div>
          )}
          <div className={styles.grid}>
            {rest.map((h) => (
              <HouseholdCard key={h.id} household={h} onManage={() => setOpenId(h.id)} />
            ))}
          </div>
        </>
      )}

      {founding && (
        <FoundHouseholdDialog
          legacyId={legacyId}
          worlds={worlds}
          sims={sims}
          homeNames={homeNames}
          onClose={() => setFounding(false)}
          onFounded={handleFounded}
        />
      )}

      {openHousehold && (
        <HouseholdDrawer
          household={openHousehold}
          households={households}
          worlds={worlds}
          sims={sims}
          autoRename={openHousehold.id === foundedId}
          onClose={() => {
            setOpenId(null)
            setFoundedId(null)
          }}
        />
      )}
    </div>
  )
}
