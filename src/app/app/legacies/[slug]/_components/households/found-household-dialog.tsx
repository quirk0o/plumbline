'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/trpc/client'
import { Dialog, Button, Combobox, PortraitAvatar, ArrowRightIcon } from '@/components/ui'
import { Plumbob } from '@/components/plumbob'
import type { HouseholdSim, WorldOption } from '../../lib/types'
import { lotOptions } from './lib'
import styles from './found-household-dialog.module.css'

export interface FoundHouseholdDialogProps {
  legacyId: string
  worlds: WorldOption[]
  /** Every sim in the legacy; selecting a housed one moves them here. */
  sims: HouseholdSim[]
  /** householdId → household name, to caption each sim's current home. */
  homeNames: Record<string, string>
  onClose: () => void
  /** Called with the new household id after a successful founding. */
  onFounded: (id: string) => void
}

function ringFor(sim: HouseholdSim): 'founder' | 'heir' | 'green' {
  return sim.isHeir ? 'heir' : sim.isFounder ? 'founder' : 'green'
}

/** Ceremonial founding modal: name, world + lot, starting funds, description,
 *  and a "move sims in" avatar picker. Mirrors the prototype's B/V1 layout. */
export function FoundHouseholdDialog({
  legacyId,
  worlds,
  sims,
  homeNames,
  onClose,
  onFounded,
}: FoundHouseholdDialogProps) {
  const router = useRouter()
  const create = trpc.households.create.useMutation()

  const [name, setName] = useState('')
  // World and lot start EMPTY — founding without an address is fine, and a
  // silent default would stamp every household with the first seeded world.
  // Picking a world still auto-fills its first canonical lot as a convenience.
  const [worldId, setWorldId] = useState<string | undefined>(undefined)
  const world = worlds.find((w) => w.id === worldId)
  const [lot, setLot] = useState<string | undefined>(undefined)
  const [funds, setFunds] = useState('20000')
  const [description, setDescription] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')

  const canFound = name.trim().length > 0 && !create.isPending

  function toggleSim(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function submit() {
    if (!canFound) return
    setError('')
    try {
      const result = await create.mutateAsync({
        legacyId,
        name: name.trim(),
        worldId,
        lot,
        funds: parseInt(funds || '0', 10),
        description: description.trim() || undefined,
        simIds: selected,
      })
      router.refresh()
      onFounded(result.id)
    } catch {
      setError("Couldn't found the household. Please try again.")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <div className={styles.closeRow}>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close">
                ✕
              </Button>
            </Dialog.Close>
          </div>

          <div className={styles.plumbobRow}>
            <Plumbob size={20} glow />
          </div>
          <Dialog.Title className={styles.eyebrow}>Found a household</Dialog.Title>

          <div className={styles.nameRow}>
            <input
              className={styles.nameInput}
              value={name}
              autoFocus
              placeholder="Name your household"
              aria-label="Household name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
              }}
            />
          </div>

          <div className={styles.gemDivider} aria-hidden="true">
            <div className={styles.gemDividerLine} />
            <Plumbob size={9} />
            <div className={styles.gemDividerLine} />
          </div>

          <div className={styles.fields}>
            <div className={styles.fieldPair}>
              <div>
                <span className={styles.fieldLabel}>World</span>
                <div className={styles.fieldControl}>
                  <Combobox
                    value={worldId ?? ''}
                    onChange={(v) => {
                      setWorldId(v)
                      const next = worlds.find((w) => w.id === v)
                      setLot(next?.lots[0])
                    }}
                    placeholder="Choose a world"
                    aria-label="World"
                  >
                    {worlds.map((w) => (
                      <Combobox.Item key={w.id} value={w.id}>
                        {w.name}
                      </Combobox.Item>
                    ))}
                  </Combobox>
                </div>
              </div>
              <div>
                <span className={styles.fieldLabel}>Lot</span>
                <div className={styles.fieldControl}>
                  <Combobox
                    value={lot ?? ''}
                    onChange={(v) => setLot(v)}
                    placeholder="Choose a lot"
                    aria-label="Lot"
                    disabled={!world}
                  >
                    {lotOptions(world, lot ?? null).map((l) => (
                      <Combobox.Item key={l} value={l}>
                        {l}
                      </Combobox.Item>
                    ))}
                  </Combobox>
                </div>
              </div>
            </div>

            <div>
              <span className={styles.fieldLabel}>Starting funds</span>
              <div className={styles.fundsInput}>
                <span className={styles.fundsSign}>§</span>
                <input
                  className={styles.fundsField}
                  value={Number(funds || '0').toLocaleString('en-US')}
                  inputMode="numeric"
                  aria-label="Starting funds"
                  onChange={(e) => setFunds(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
            </div>

            <div>
              <label className={styles.fieldLabel} htmlFor="found-description">
                Description
              </label>
              <textarea
                id="found-description"
                className={styles.descriptionField}
                rows={2}
                value={description}
                placeholder="A line to remember this household by…"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.residentsBlock}>
            <span className={styles.fieldLabel}>Move sims in</span>
            <p className={styles.residentsHint}>Sims already in a household will move here.</p>
            {sims.length === 0 ? (
              <p className={styles.noSims}>No sims yet.</p>
            ) : (
              <div className={styles.residentsGrid}>
                {sims.map((s) => {
                  const on = selected.includes(s.id)
                  const home = s.householdId ? homeNames[s.householdId] : undefined
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={styles.simPick}
                      aria-pressed={on}
                      aria-label={`${s.firstName} ${s.lastName} — ${home ?? 'Unhoused'}`}
                      onClick={() => toggleSim(s.id)}
                    >
                      <span
                        className={`${styles.simPickAvatar} ${on ? styles.simPickAvatarOn : ''}`}
                      >
                        <PortraitAvatar
                          imageUrl={s.imageUrl}
                          firstName={s.firstName}
                          lastName={s.lastName}
                          size={44}
                          ring={ringFor(s)}
                        />
                        {on && (
                          <span className={styles.simPickCheck} aria-hidden="true">
                            ✓
                          </span>
                        )}
                      </span>
                      <span className={`${styles.simPickName} ${on ? styles.simPickNameOn : ''}`}>
                        {s.firstName}
                      </span>
                      <span className={styles.simPickHome}>{home ?? 'Unhoused'}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}

          <div className={styles.submitRow}>
            <Button type="button" className={styles.submit} disabled={!canFound} onClick={() => void submit()}>
              Found the household <ArrowRightIcon size={15} />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
