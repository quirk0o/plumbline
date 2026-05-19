'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { Combobox } from '@/components/ui'
import styles from './page.module.css'

type SimMini = { id: string; firstName: string; lastName: string; imageUrl: string | null }

const ROMANTIC_STATUS_OPTIONS: RomanticStatus[] = [
  RomanticStatus.DATING,
  RomanticStatus.ENGAGED,
  RomanticStatus.MARRIED,
  RomanticStatus.EX_PARTNER,
  RomanticStatus.WIDOWED,
]

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface Props {
  familyAvailable: SimMini[]
  partnerAvailable: SimMini[]
  onAddFamily: (pickedId: string, role: 'parent' | 'child', relType: FamilyRelationshipType) => void
  onAddPartner: (pickedId: string, status: RomanticStatus) => void
  onClose: () => void
}

export function AddRelationshipModal({
  familyAvailable,
  partnerAvailable,
  onAddFamily,
  onAddPartner,
  onClose,
}: Props) {
  const [tab, setTab] = useState<'partner' | 'family'>('partner')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [role, setRole] = useState<'parent' | 'child'>('child')
  const [relType, setRelType] = useState<FamilyRelationshipType>(FamilyRelationshipType.BIOLOGICAL)
  const [romanticStatus, setRomanticStatus] = useState<RomanticStatus>(RomanticStatus.DATING)

  function handleTabChange(next: 'partner' | 'family') {
    setTab(next)
    setPickedId(null)
  }

  function handleConfirm() {
    if (!pickedId) return
    if (tab === 'partner') {
      onAddPartner(pickedId, romanticStatus)
    } else {
      onAddFamily(pickedId, role, relType)
    }
  }

  const sims = tab === 'partner' ? partnerAvailable : familyAvailable

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.modalTitle}>Add relationship</p>

        <div className={styles.relTabRow}>
          <button
            className={`${styles.relTab} ${tab === 'partner' ? styles.relTabActive : ''}`}
            onClick={() => handleTabChange('partner')}
          >
            Partner
          </button>
          <button
            className={`${styles.relTab} ${tab === 'family' ? styles.relTabActive : ''}`}
            onClick={() => handleTabChange('family')}
          >
            Family
          </button>
        </div>

        <div className={styles.simCards} style={{ maxHeight: '240px', overflowY: 'auto' }}>
          {sims.map((sim) => (
            <button
              key={sim.id}
              className={styles.simCard}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setPickedId(sim.id)}
              aria-pressed={pickedId === sim.id}
            >
              <div
                className={styles.simPortraitWrap}
                style={pickedId === sim.id ? { borderColor: 'var(--green)' } : undefined}
              >
                {sim.imageUrl ? (
                  <Image
                    src={sim.imageUrl}
                    alt={sim.firstName}
                    fill
                    sizes="72px"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className={styles.simInitials} aria-hidden="true">
                    {sim.firstName[0]}{sim.lastName[0]}
                  </span>
                )}
              </div>
              <span className={styles.simCardName}>{sim.firstName} {sim.lastName}</span>
            </button>
          ))}
        </div>

        {tab === 'partner' ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
            Romantic status
            <Combobox
              value={romanticStatus}
              onChange={(v) => setRomanticStatus(v as RomanticStatus)}
              size="sm"
              aria-label="Romantic status"
            >
              {ROMANTIC_STATUS_OPTIONS.map((s) => (
                <Combobox.Item key={s} value={s}>{formatStatus(s)}</Combobox.Item>
              ))}
            </Combobox>
          </label>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
              Role
              <Combobox
                value={role}
                onChange={(v) => setRole(v as 'parent' | 'child')}
                size="sm"
                aria-label="Role"
              >
                <Combobox.Item value="parent">This sim is the parent</Combobox.Item>
                <Combobox.Item value="child">This sim is the child</Combobox.Item>
              </Combobox>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
              Relationship type
              <Combobox
                value={relType}
                onChange={(v) => setRelType(v as FamilyRelationshipType)}
                size="sm"
                aria-label="Relationship type"
              >
                <Combobox.Item value={FamilyRelationshipType.BIOLOGICAL}>Biological</Combobox.Item>
                <Combobox.Item value={FamilyRelationshipType.ADOPTIVE}>Adoptive</Combobox.Item>
                <Combobox.Item value={FamilyRelationshipType.STEP}>Step</Combobox.Item>
              </Combobox>
            </label>
          </div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.editableChip}
            style={{ background: 'var(--green)', color: 'white', borderColor: 'var(--green)' }}
            onClick={handleConfirm}
            disabled={!pickedId}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
