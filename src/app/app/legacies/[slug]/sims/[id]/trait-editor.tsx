'use client'

import { useState } from 'react'
import { trpc } from '@/trpc/client'
import { TraitPicker, type Trait } from '@/app/components/trait-picker'
import styles from './page.module.css'

interface SimProp {
  id: string
  personalityTraits: { personalityTrait: { id: string; name: string } }[]
}

export function TraitEditor({ sim, traits }: { sim: SimProp; traits: Trait[] }) {
  const [localTraitIds, setLocalTraitIds] = useState<string[]>(
    sim.personalityTraits.map((t) => t.personalityTrait.id),
  )
  const [picking, setPicking] = useState(false)
  const addTrait = trpc.sims.addTrait.useMutation()
  const removeTrait = trpc.sims.removeTrait.useMutation()

  function handleAdd(traitId: string) {
    setLocalTraitIds((prev) => [...prev, traitId])
    addTrait.mutate(
      { simId: sim.id, traitId },
      { onError: () => setLocalTraitIds((prev) => prev.filter((id) => id !== traitId)) },
    )
  }

  function handleRemove(traitId: string) {
    setLocalTraitIds((prev) => prev.filter((id) => id !== traitId))
    removeTrait.mutate(
      { simId: sim.id, traitId },
      { onError: () => setLocalTraitIds((prev) => [...prev, traitId]) },
    )
  }

  function handlePickerChange(ids: string[]) {
    const added = ids.find((id) => !localTraitIds.includes(id))
    const removed = localTraitIds.find((id) => !ids.includes(id))
    if (added) handleAdd(added)
    if (removed) handleRemove(removed)
  }

  const localTraits = localTraitIds.map((id) => {
    const found = traits.find((t) => t.id === id)
    return found ?? { id, name: id, category: null, conflictsWith: [] }
  })

  return (
    <>
      <div className={styles.traitList}>
        {localTraits.map((trait) => (
          <span key={trait.id} className={styles.traitChip}>
            {trait.name}
            <button
              className={styles.traitRemove}
              aria-label={`Remove ${trait.name}`}
              onClick={() => handleRemove(trait.id)}
            >
              ×
            </button>
          </span>
        ))}
        {localTraitIds.length < 6 && (
          <button className={styles.addChip} onClick={() => setPicking(true)}>
            + Add trait
          </button>
        )}
      </div>

      {picking && (
        <div className={styles.pickerOverlay} onClick={() => setPicking(false)}>
          <div className={styles.pickerBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pickerClose}>
              <button className={styles.removeBtn} onClick={() => setPicking(false)}>
                Close
              </button>
            </div>
            <TraitPicker
              traits={traits}
              selected={localTraitIds}
              onChange={handlePickerChange}
              max={6}
              scrollableGrid
            />
          </div>
        </div>
      )}
    </>
  )
}
