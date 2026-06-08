'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { trpc } from '@/trpc/client'
import { Combobox } from '@/components/ui'
import { AddRelationshipModal } from './add-relationship-modal'
import styles from './page.module.css'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

interface FamilyMember {
  sim: SimMini
  relType: FamilyRelationshipType
  role: 'parent' | 'child'
  parentId: string
  childId: string
}

interface SocialRel {
  sim: SimMini
  romanticStatus: RomanticStatus
  simAId: string
  simBId: string
}

interface SimProp {
  id: string
  legacyId: string
  parentsOf: { child: SimMini; type: string }[]
  childOf: { parent: SimMini; type: string }[]
  socialRelationshipsA: { simB: SimMini; romanticStatus: string }[]
  socialRelationshipsB: { simA: SimMini; romanticStatus: string }[]
}

const ROMANTIC_STATUS_OPTIONS: RomanticStatus[] = [
  RomanticStatus.DATING,
  RomanticStatus.ENGAGED,
  RomanticStatus.MARRIED,
  RomanticStatus.PARTNER,
  RomanticStatus.EX_PARTNER,
  RomanticStatus.WIDOWED,
]

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function familyLabel(m: FamilyMember) {
  const roleLabel = m.role === 'parent' ? 'Parent' : 'Child'
  return `${roleLabel} · ${m.relType.charAt(0) + m.relType.slice(1).toLowerCase()}`
}

export function RelationshipsEditor({
  sim,
  slug,
  legacySims,
}: {
  sim: SimProp
  slug: string
  legacySims: SimMini[]
}) {
  const legacyId = sim.legacyId
  const addFamily = trpc.sims.addFamilyRelationship.useMutation()
  const removeFamily = trpc.sims.removeFamilyRelationship.useMutation()
  const addSocial = trpc.sims.addSocialRelationship.useMutation()
  const updateSocial = trpc.sims.updateSocialRelationship.useMutation()
  const removeSocial = trpc.sims.removeSocialRelationship.useMutation()

  const [members, setMembers] = useState<FamilyMember[]>([
    ...sim.parentsOf.map((r) => ({
      sim: r.child,
      relType: r.type as FamilyRelationshipType,
      role: 'child' as const,
      parentId: sim.id,
      childId: r.child.id,
    })),
    ...sim.childOf.map((r) => ({
      sim: r.parent,
      relType: r.type as FamilyRelationshipType,
      role: 'parent' as const,
      parentId: r.parent.id,
      childId: sim.id,
    })),
  ])

  const [partners, setPartners] = useState<SocialRel[]>([
    ...sim.socialRelationshipsA
      .filter((r) => r.romanticStatus !== RomanticStatus.NONE)
      .map((r) => {
        const [a, b] = [sim.id, r.simB.id].sort()
        return { sim: r.simB, romanticStatus: r.romanticStatus as RomanticStatus, simAId: a, simBId: b }
      }),
    ...sim.socialRelationshipsB
      .filter((r) => r.romanticStatus !== RomanticStatus.NONE)
      .map((r) => {
        const [a, b] = [sim.id, r.simA.id].sort()
        return { sim: r.simA, romanticStatus: r.romanticStatus as RomanticStatus, simAId: a, simBId: b }
      }),
  ])

  const [adding, setAdding] = useState(false)

  const partnerLinkedIds = new Set([...partners.map((r) => r.sim.id), sim.id])
  const familyLinkedIds = new Set([...members.map((m) => m.sim.id), sim.id])
  const partnerAvailable = legacySims.filter((s) => !partnerLinkedIds.has(s.id))
  const familyAvailable = legacySims.filter((s) => !familyLinkedIds.has(s.id))

  function handleAddPartner(picked: SimMini, romanticStatus: RomanticStatus) {
    const [a, b] = [sim.id, picked.id].sort()
    const rel: SocialRel = { sim: picked, romanticStatus, simAId: a, simBId: b }
    setPartners((prev) => [...prev, rel])
    addSocial.mutate(
      { simAId: a, simBId: b, romanticStatus },
      { onError: () => setPartners((prev) => prev.filter((r) => r.sim.id !== picked.id)) },
    )
    setAdding(false)
  }

  function handleAddFamily(picked: SimMini, role: 'parent' | 'child', relType: FamilyRelationshipType) {
    const parentId = role === 'parent' ? picked.id : sim.id
    const childId = role === 'parent' ? sim.id : picked.id
    setMembers((prev) => [...prev, { sim: picked, relType, role, parentId, childId }])
    addFamily.mutate(
      { parentId, childId, type: relType },
      { onError: () => setMembers((prev) => prev.filter((m) => m.sim.id !== picked.id)) },
    )
    setAdding(false)
  }

  function handleStatusChange(rel: SocialRel, romanticStatus: RomanticStatus) {
    const previousStatus = rel.romanticStatus
    setPartners((prev) =>
      prev.map((r) => (r.sim.id === rel.sim.id ? { ...r, romanticStatus } : r)),
    )
    updateSocial.mutate(
      { simAId: rel.simAId, simBId: rel.simBId, romanticStatus },
      {
        onError: () =>
          setPartners((prev) =>
            prev.map((r) => (r.sim.id === rel.sim.id ? { ...r, romanticStatus: previousStatus } : r)),
          ),
      },
    )
  }

  function handleRemovePartner(rel: SocialRel) {
    setPartners((prev) => prev.filter((r) => r.sim.id !== rel.sim.id))
    removeSocial.mutate(
      { simAId: rel.simAId, simBId: rel.simBId },
      { onError: () => setPartners((prev) => [...prev, rel]) },
    )
  }

  function handleRemoveFamily(m: FamilyMember) {
    setMembers((prev) => prev.filter((x) => x.sim.id !== m.sim.id || x.role !== m.role))
    removeFamily.mutate(
      { parentId: m.parentId, childId: m.childId },
      { onError: () => setMembers((prev) => [...prev, m]) },
    )
  }

  return (
    <>
      <div className={styles.simCards}>
        <button
          className={`${styles.simCard} ${styles.addCard}`}
          onClick={() => setAdding(true)}
        >
          <div className={styles.simPortraitWrap}>
            <span className={styles.addCardIcon}>+</span>
          </div>
          <span className={styles.simCardName}>Add</span>
        </button>

        {partners.map((rel) => (
          <div key={rel.sim.id} className={styles.simCard}>
            <Link href={`/app/legacies/${slug}/sims/${rel.sim.id}`} style={{ display: 'contents' }}>
              <div className={styles.simPortraitOuter}>
                <div className={`${styles.simPortraitWrap} ${styles.simPortraitPartner}`}>
                  {rel.sim.imageUrl ? (
                    <Image
                      src={rel.sim.imageUrl}
                      alt={rel.sim.firstName}
                      fill
                      sizes="72px"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : (
                    <span className={styles.simInitials} aria-hidden="true">
                      {rel.sim.firstName[0]}{rel.sim.lastName[0]}
                    </span>
                  )}
                </div>
                <span className={styles.partnerBadge} aria-hidden="true">Partner</span>
              </div>
              <span className={styles.simCardName}>{rel.sim.firstName} {rel.sim.lastName}</span>
            </Link>
            <div onClick={(e) => e.stopPropagation()}>
              <Combobox
                value={rel.romanticStatus}
                onChange={(v) => handleStatusChange(rel, v as RomanticStatus)}
                size="sm"
                aria-label={`Romantic status with ${rel.sim.firstName}`}
              >
                {ROMANTIC_STATUS_OPTIONS.map((s) => (
                  <Combobox.Item key={s} value={s}>{formatStatus(s)}</Combobox.Item>
                ))}
              </Combobox>
            </div>
            <button
              className={styles.simCardRemove}
              aria-label={`Remove ${rel.sim.firstName}`}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleRemovePartner(rel)
              }}
            >
              ×
            </button>
          </div>
        ))}

        {members.map((m) => (
          <div key={`${m.sim.id}-${m.role}`} className={styles.simCard}>
            <Link href={`/app/legacies/${slug}/sims/${m.sim.id}`} style={{ display: 'contents' }}>
              <div className={styles.simPortraitWrap}>
                {m.sim.imageUrl ? (
                  <Image
                    src={m.sim.imageUrl}
                    alt={m.sim.firstName}
                    fill
                    sizes="72px"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className={styles.simInitials} aria-hidden="true">
                    {m.sim.firstName[0]}{m.sim.lastName[0]}
                  </span>
                )}
              </div>
              <span className={styles.simCardName}>{m.sim.firstName} {m.sim.lastName}</span>
              <span className={styles.simCardSub}>{familyLabel(m)}</span>
            </Link>
            <button
              className={styles.simCardRemove}
              aria-label={`Remove ${m.sim.firstName}`}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                handleRemoveFamily(m)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <AddRelationshipModal
          legacyId={legacyId}
          familyAvailable={familyAvailable}
          partnerAvailable={partnerAvailable}
          onAddFamily={handleAddFamily}
          onAddPartner={handleAddPartner}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  )
}
