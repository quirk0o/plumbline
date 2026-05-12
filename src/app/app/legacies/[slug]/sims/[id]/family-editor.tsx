'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FamilyRelationshipType } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { SimPickerModal } from './sim-picker-modal'
import styles from './page.module.css'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

interface FamilyMember {
  sim: SimMini
  relType: FamilyRelationshipType
  role: 'parent' | 'child'
  parentId: string
  childId: string
}

interface SimProp {
  id: string
  legacyId: string
  parentsOf: { child: SimMini; type: string }[]
  childOf: { parent: SimMini; type: string }[]
}

export function FamilyEditor({ sim, slug, legacySims }: { sim: SimProp; slug: string; legacySims: SimMini[] }) {
  const addRel = trpc.sims.addFamilyRelationship.useMutation()
  const removeRel = trpc.sims.removeFamilyRelationship.useMutation()

  const [members, setMembers] = useState<FamilyMember[]>([
    ...sim.parentsOf.map((r) => ({
      sim: r.child, relType: r.type as FamilyRelationshipType, role: 'child' as const,
      parentId: sim.id, childId: r.child.id,
    })),
    ...sim.childOf.map((r) => ({
      sim: r.parent, relType: r.type as FamilyRelationshipType, role: 'parent' as const,
      parentId: r.parent.id, childId: sim.id,
    })),
  ])

  const [adding, setAdding] = useState(false)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [role, setRole] = useState<'parent' | 'child'>('child')
  const [relType, setRelType] = useState<FamilyRelationshipType>(FamilyRelationshipType.BIOLOGICAL)

  const linkedIds = new Set([...members.map((m) => m.sim.id), sim.id])
  const available = legacySims.filter((s) => !linkedIds.has(s.id))

  function handleConfirm() {
    if (!pickedId) return
    const picked = legacySims.find((s) => s.id === pickedId)
    if (!picked) return
    const parentId = role === 'parent' ? pickedId : sim.id
    const childId = role === 'parent' ? sim.id : pickedId
    setMembers((prev) => [...prev, { sim: picked, relType, role, parentId, childId }])
    addRel.mutate(
      { parentId, childId, type: relType },
      { onError: () => setMembers((prev) => prev.filter((m) => m.sim.id !== pickedId)) },
    )
    setAdding(false)
    setPickedId(null)
  }

  function handleRemove(m: FamilyMember) {
    setMembers((prev) => prev.filter((x) => x.sim.id !== m.sim.id || x.role !== m.role))
    removeRel.mutate(
      { parentId: m.parentId, childId: m.childId },
      { onError: () => setMembers((prev) => [...prev, m]) },
    )
  }

  function relLabel(m: FamilyMember) {
    const roleLabel = m.role === 'parent' ? 'Parent' : 'Child'
    return `${roleLabel} · ${m.relType.charAt(0) + m.relType.slice(1).toLowerCase()}`
  }

  return (
    <>
      <div className={styles.simCards}>
        {members.map((m) => (
          <div key={`${m.sim.id}-${m.role}`} className={styles.simCard}>
            <Link href={`/app/legacies/${slug}/sims/${m.sim.id}`} style={{ display: 'contents' }}>
              <div className={styles.simPortraitWrap}>
                {m.sim.imageUrl ? (
                  <Image src={m.sim.imageUrl} alt={m.sim.firstName} fill sizes="72px" style={{ objectFit: 'cover' }} />
                ) : (
                  <span className={styles.simInitials} aria-hidden="true">
                    {m.sim.firstName[0]}{m.sim.lastName[0]}
                  </span>
                )}
              </div>
              <span className={styles.simCardName}>{m.sim.firstName} {m.sim.lastName}</span>
              <span className={styles.simCardSub}>{relLabel(m)}</span>
            </Link>
            <button
              className={styles.simCardRemove}
              aria-label={`Remove ${m.sim.firstName}`}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleRemove(m) }}
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
            <span className={styles.simCardName}>Add family</span>
          </button>
        )}
      </div>

      {adding && (
        <SimPickerModal
          title="Add family member"
          sims={available}
          selected={pickedId}
          onSelect={setPickedId}
          onConfirm={handleConfirm}
          onClose={() => { setAdding(false); setPickedId(null) }}
          confirmDisabled={!pickedId}
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
              Role
              <select
                className={styles.editableChip}
                value={role}
                onChange={(e) => setRole(e.target.value as 'parent' | 'child')}
              >
                <option value="parent">This sim is the parent</option>
                <option value="child">This sim is the child</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
              Relationship type
              <select
                className={styles.editableChip}
                value={relType}
                onChange={(e) => setRelType(e.target.value as FamilyRelationshipType)}
              >
                <option value={FamilyRelationshipType.BIOLOGICAL}>Biological</option>
                <option value={FamilyRelationshipType.ADOPTIVE}>Adoptive</option>
                <option value={FamilyRelationshipType.STEP}>Step</option>
              </select>
            </label>
          </div>
        </SimPickerModal>
      )}
    </>
  )
}
