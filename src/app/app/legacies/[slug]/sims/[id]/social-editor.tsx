'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { RomanticStatus } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { SimPickerModal } from './sim-picker-modal'
import styles from './page.module.css'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

const ROMANTIC_STATUS_OPTIONS: RomanticStatus[] = [
  RomanticStatus.NONE,
  RomanticStatus.DATING,
  RomanticStatus.ENGAGED,
  RomanticStatus.MARRIED,
  RomanticStatus.EX_PARTNER,
  RomanticStatus.WIDOWED,
]

function formatStatus(s: string) {
  return s === 'NONE' ? 'Friends' : s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface SocialRel {
  sim: SimMini
  romanticStatus: RomanticStatus
  simAId: string
  simBId: string
}

interface SimProp {
  id: string
  socialRelationshipsA: { simB: SimMini; romanticStatus: string }[]
  socialRelationshipsB: { simA: SimMini; romanticStatus: string }[]
}

export function SocialEditor({ sim, slug, legacySims }: { sim: SimProp; slug: string; legacySims: SimMini[] }) {
  const addRel = trpc.sims.addSocialRelationship.useMutation()
  const updateRel = trpc.sims.updateSocialRelationship.useMutation()
  const removeRel = trpc.sims.removeSocialRelationship.useMutation()

  const [rels, setRels] = useState<SocialRel[]>([
    ...sim.socialRelationshipsA.map((r) => {
      const [a, b] = [sim.id, r.simB.id].sort()
      return { sim: r.simB, romanticStatus: r.romanticStatus as RomanticStatus, simAId: a, simBId: b }
    }),
    ...sim.socialRelationshipsB.map((r) => {
      const [a, b] = [sim.id, r.simA.id].sort()
      return { sim: r.simA, romanticStatus: r.romanticStatus as RomanticStatus, simAId: a, simBId: b }
    }),
  ])

  const [adding, setAdding] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [newStatus, setNewStatus] = useState<RomanticStatus>(RomanticStatus.NONE)

  const linkedIds = new Set([...rels.map((r) => r.sim.id), sim.id])
  const available = legacySims.filter((s) => !linkedIds.has(s.id))

  function handleConfirm() {
    if (!pickedId) return
    const picked = legacySims.find((s) => s.id === pickedId)
    if (!picked) return
    const [a, b] = [sim.id, pickedId].sort()
    const rel: SocialRel = { sim: picked, romanticStatus: newStatus, simAId: a, simBId: b }
    setRels((prev) => [...prev, rel])
    addRel.mutate(
      { simAId: a, simBId: b, romanticStatus: newStatus },
      { onError: () => setRels((prev) => prev.filter((r) => r.sim.id !== pickedId)) },
    )
    setAdding(false)
    setPickedId(null)
    setNewStatus(RomanticStatus.NONE)
  }

  function handleStatusChange(rel: SocialRel, romanticStatus: RomanticStatus) {
    const previousStatus = rel.romanticStatus
    setRels((prev) => prev.map((r) => r.sim.id === rel.sim.id ? { ...r, romanticStatus } : r))
    updateRel.mutate(
      { simAId: rel.simAId, simBId: rel.simBId, romanticStatus },
      { onError: () => setRels((prev) => prev.map((r) => r.sim.id === rel.sim.id ? { ...r, romanticStatus: previousStatus } : r)) },
    )
  }

  function handleRemove(rel: SocialRel) {
    setRels((prev) => prev.filter((r) => r.sim.id !== rel.sim.id))
    removeRel.mutate(
      { simAId: rel.simAId, simBId: rel.simBId },
      { onError: () => setRels((prev) => [...prev, rel]) },
    )
  }

  return (
    <>
      <div className={styles.simCards}>
        {rels.map((rel) => (
          <div key={rel.sim.id} className={styles.simCard}>
            <Link href={`/app/legacies/${slug}/sims/${rel.sim.id}`} style={{ display: 'contents' }}>
              <div className={styles.simPortraitWrap}>
                {rel.sim.imageUrl ? (
                  <Image src={rel.sim.imageUrl} alt={rel.sim.firstName} fill sizes="72px" style={{ objectFit: 'cover' }} />
                ) : (
                  <span className={styles.simInitials} aria-hidden="true">
                    {rel.sim.firstName[0]}{rel.sim.lastName[0]}
                  </span>
                )}
              </div>
              <span className={styles.simCardName}>{rel.sim.firstName} {rel.sim.lastName}</span>
            </Link>
            <select
              className={styles.simCardSub}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)' }}
              value={rel.romanticStatus}
              aria-label={`Romantic status with ${rel.sim.firstName}`}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleStatusChange(rel, e.target.value as RomanticStatus)}
            >
              {ROMANTIC_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
            <button
              className={styles.simCardRemove}
              aria-label={`Remove ${rel.sim.firstName}`}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemove(rel) }}
            >
              ×
            </button>
          </div>
        ))}

        {available.length > 0 && (
          <button className={`${styles.simCard} ${styles.addCard}`} onClick={() => setAdding(true)}>
            <div className={styles.simPortraitWrap}>
              <span className={styles.addCardIcon}>+</span>
            </div>
            <span className={styles.simCardName}>Add connection</span>
          </button>
        )}
      </div>

      {adding && (
        <SimPickerModal
          title="Add social connection"
          sims={available}
          selected={pickedId}
          onSelect={setPickedId}
          onConfirm={handleConfirm}
          onClose={() => { setAdding(false); setPickedId(null) }}
          confirmDisabled={!pickedId}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
            Romantic status
            <select
              className={styles.editableChip}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as RomanticStatus)}
            >
              {ROMANTIC_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
            </select>
          </label>
        </SimPickerModal>
      )}
    </>
  )
}
