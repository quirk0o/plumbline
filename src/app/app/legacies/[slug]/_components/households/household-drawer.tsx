'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/client'
import {
  Button,
  Combobox,
  Drawer,
  EditableHeading,
  EditableStat,
  EditableText,
  EmptyState,
  HouseIcon,
  PortraitAvatar,
} from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import { roman } from '@/lib/legacy-format'
import type { HouseholdView, HouseholdSim, WorldOption } from '../../lib/types'
import { worldOptions, lotOptions } from './lib'
import { NowPlayingPill } from './featured-household'
import { ResidentRow } from './resident-row'
import styles from './household-drawer.module.css'

export interface HouseholdDrawerProps {
  household: HouseholdView
  households: HouseholdView[]
  worlds: WorldOption[]
  /** Every sim in the legacy — the move-in select offers the ones elsewhere. */
  sims: HouseholdSim[]
  /** Open with the name in edit mode (right after founding). */
  autoRename: boolean
  onClose: () => void
}

/**
 * Right-side management drawer (G° ceremonial, no crest): inline-editable
 * identity on a parchment header; stats, residents, and move controls on the
 * card-surface body. Every mutation is a tRPC call + router.refresh() — the
 * drawer re-reads its household from refreshed props by id (the section
 * resolves that), so server data stays the single source of truth.
 */
export function HouseholdDrawer({
  household: h,
  households,
  worlds,
  sims,
  autoRename,
  onClose,
}: HouseholdDrawerProps) {
  const router = useRouter()
  const update = trpc.households.update.useMutation()
  const setActive = trpc.households.setActive.useMutation()
  const moveSim = trpc.households.moveSim.useMutation()
  const [error, setError] = useState('')

  const others = households.filter((x) => x.id !== h.id)
  const movableIn = sims.filter((s) => s.householdId !== h.id)
  const worldChoices = worldOptions(worlds, { worldId: h.worldId, worldName: h.worldName })
  const currentWorld = worldChoices.find((w) => w.id === h.worldId)

  /** Shared mutation wrapper: clear error → mutate → refresh. Rapid successive
   *  commits can clear a prior failure's message (last-error-wins) — accepted
   *  for this single-user surface. */
  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      router.refresh()
    } catch {
      setError("Couldn't save that change. Please try again.")
    }
  }

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose() }}>
      <Drawer.Portal>
        <Drawer.Overlay />
        <Drawer.Content side="right" className={styles.content} aria-describedby={undefined}>
          <header className={styles.header}>
            <div className={styles.headerTop}>
              {h.isActive ? (
                <NowPlayingPill />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void run(() => setActive.mutateAsync({ householdId: h.id }))}
                >
                  Set as active
                </Button>
              )}
              <Drawer.Close asChild>
                <Button type="button" variant="ghost" size="sm" className={styles.close} aria-label="Close">
                  ✕
                </Button>
              </Drawer.Close>
            </div>

            <Drawer.Title asChild>
              <div className={styles.nameWrap}>
                <EditableHeading
                  value={h.name}
                  autoEdit={autoRename}
                  aria-label="Household name"
                  onCommit={(name) => void run(() => update.mutateAsync({ householdId: h.id, name }))}
                />
              </div>
            </Drawer.Title>

            <div className={styles.lotRow}>
              <HouseIcon size={13} />
              <Combobox
                variant="inline"
                value={h.worldId ?? ''}
                onChange={(worldId) => {
                  const next = worldChoices.find((w) => w.id === worldId)
                  void run(() =>
                    update.mutateAsync({
                      householdId: h.id,
                      worldId,
                      lot: next?.lots[0] ?? h.lot,
                    }),
                  )
                }}
                placeholder={h.worldName ?? 'Choose a world'}
                aria-label="World"
              >
                {worldChoices.map((w) => (
                  <Combobox.Item key={w.id} value={w.id}>
                    {w.name}
                  </Combobox.Item>
                ))}
              </Combobox>
              <span className={styles.lotDot} aria-hidden="true">·</span>
              <Combobox
                variant="inline"
                value={h.lot ?? ''}
                onChange={(lot) => void run(() => update.mutateAsync({ householdId: h.id, lot }))}
                placeholder={h.lot ?? 'Choose a lot'}
                aria-label="Lot"
              >
                {lotOptions(currentWorld, h.lot).map((l) => (
                  <Combobox.Item key={l} value={l}>
                    {l}
                  </Combobox.Item>
                ))}
              </Combobox>
            </div>

            <div className={styles.descriptionWrap}>
              <EditableText
                multiline
                value={h.description ?? ''}
                placeholder="Add a note about this household…"
                aria-label="Household description"
                className={styles.description}
                onCommit={(description) =>
                  void run(() =>
                    update.mutateAsync({ householdId: h.id, description: description || null }),
                  )
                }
              />
            </div>
          </header>

          <div className={styles.body}>
            <div className={styles.stats}>
              <EditableStat
                value={h.funds}
                label="Funds"
                green
                onCommit={(funds) => void run(() => update.mutateAsync({ householdId: h.id, funds }))}
              />
              <EditableStat
                value={h.lotValue}
                label="Lot value"
                onCommit={(lotValue) =>
                  void run(() => update.mutateAsync({ householdId: h.id, lotValue }))
                }
              />
              {h.foundedGeneration !== null && (
                <div className={styles.foundedStat}>
                  <span className={styles.foundedValue}>Gen {roman(h.foundedGeneration)}</span>
                  <span className={styles.foundedLabel}>Founded</span>
                </div>
              )}
            </div>

            <div className={styles.gemDivider} aria-hidden="true">
              <div className={styles.gemDividerLine} />
              <Plumbob size={9} />
              <div className={styles.gemDividerLine} />
            </div>

            <div className={styles.residentsLabel}>
              Residents <span className={styles.residentsCount}>{h.residents.length}</span>
            </div>

            {h.residents.length === 0 ? (
              <div className={styles.emptyLot}>
                <EmptyState>This lot is empty — bring a sim in to begin.</EmptyState>
              </div>
            ) : (
              <div className={styles.residentsList}>
                {h.residents.map((r) => (
                  <ResidentRow
                    key={r.id}
                    resident={r}
                    others={others}
                    onMoveTo={(toHouseholdId) =>
                      void run(() => moveSim.mutateAsync({ simId: r.id, toHouseholdId }))
                    }
                  />
                ))}
              </div>
            )}

            <div className={styles.moveInWrap}>
              <Combobox
                variant="ghost"
                value=""
                onChange={(simId) =>
                  void run(() => moveSim.mutateAsync({ simId, toHouseholdId: h.id }))
                }
                placeholder="Move a sim in"
                aria-label="Move a sim in"
              >
                {movableIn.length === 0 && (
                  <Combobox.Item value="__none__" disabled>
                    Every sim already lives here.
                  </Combobox.Item>
                )}
                {others
                  .filter((o) => o.residents.length > 0)
                  .map((o) => (
                    <Combobox.Section key={o.id} heading={o.name}>
                      {o.residents.map((s) => (
                        <Combobox.Item key={s.id} value={s.id} textValue={`${s.firstName} ${s.lastName}`}>
                          <span className={styles.optionRow}>
                            <PortraitAvatar
                              imageUrl={s.imageUrl}
                              firstName={s.firstName}
                              lastName={s.lastName}
                              size={24}
                            />
                            <span className={styles.optionLabel}>
                              {s.firstName} {s.lastName}
                            </span>
                          </span>
                        </Combobox.Item>
                      ))}
                    </Combobox.Section>
                  ))}
                {movableIn.some((s) => s.householdId === null) && (
                  <Combobox.Section heading="Unhoused">
                    {movableIn
                      .filter((s) => s.householdId === null)
                      .map((s) => (
                        <Combobox.Item key={s.id} value={s.id} textValue={`${s.firstName} ${s.lastName}`}>
                          <span className={styles.optionRow}>
                            <PortraitAvatar
                              imageUrl={s.imageUrl}
                              firstName={s.firstName}
                              lastName={s.lastName}
                              size={24}
                            />
                            <span className={styles.optionLabel}>
                              {s.firstName} {s.lastName}
                            </span>
                          </span>
                        </Combobox.Item>
                      ))}
                  </Combobox.Section>
                )}
              </Combobox>
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer>
  )
}
