'use client'

import { useState } from 'react'
import { FamilyRelationshipType, RomanticStatus } from '@prisma/client'
import { Combobox, Dialog } from '@/components/ui'
import { CreateSimModal } from '@/app/components/create-sim-modal'
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
  legacyId: string
  familyAvailable: SimMini[]
  partnerAvailable: SimMini[]
  onAddFamily: (sim: SimMini, role: 'parent' | 'child', relType: FamilyRelationshipType) => void
  onAddPartner: (sim: SimMini, status: RomanticStatus) => void
  onClose: () => void
}

export function AddRelationshipModal({
  legacyId,
  familyAvailable,
  partnerAvailable,
  onAddFamily,
  onAddPartner,
  onClose,
}: Props) {
  const [tab, setTab] = useState<'partner' | 'family'>('partner')
  const [pickedSim, setPickedSim] = useState<SimMini | null>(null)
  const [role, setRole] = useState<'parent' | 'child'>('child')
  const [relType, setRelType] = useState<FamilyRelationshipType>(FamilyRelationshipType.BIOLOGICAL)
  const [romanticStatus, setRomanticStatus] = useState<RomanticStatus>(RomanticStatus.DATING)
  const [showCreate, setShowCreate] = useState(false)
  const [extraSims, setExtraSims] = useState<SimMini[]>([])

  function handleTabChange(next: 'partner' | 'family') {
    setTab(next)
    setPickedSim(null)
  }

  function handleSimSelect(value: string) {
    if (value === '__create__') {
      setShowCreate(true)
      return
    }
    const allSims = [...partnerAvailable, ...familyAvailable, ...extraSims]
    setPickedSim(allSims.find((s) => s.id === value) ?? null)
  }

  function handleCreated(newSim: SimMini) {
    setExtraSims((prev) => [...prev, newSim])
    setPickedSim(newSim)
    setShowCreate(false)
  }

  function handleConfirm() {
    if (!pickedSim) return
    if (tab === 'partner') {
      onAddPartner(pickedSim, romanticStatus)
    } else {
      onAddFamily(pickedSim, role, relType)
    }
  }

  const availableSims = [...(tab === 'partner' ? partnerAvailable : familyAvailable), ...extraSims]

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open && !showCreate) onClose() }}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content size="sm">
            <Dialog.Title>Add relationship</Dialog.Title>

            <div hidden={showCreate}>
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

              <Combobox
                value={pickedSim?.id ?? ''}
                onChange={handleSimSelect}
                placeholder="Select sim…"
                aria-label="Select sim"
              >
                {availableSims.map((sim) => (
                  <Combobox.Item
                    key={sim.id}
                    value={sim.id}
                    textValue={`${sim.firstName} ${sim.lastName}`}
                  >
                    {sim.firstName} {sim.lastName}
                  </Combobox.Item>
                ))}
                <Combobox.Item value="__create__" textValue="Create new sim…">
                  <span style={{ color: 'var(--green)', fontWeight: 'var(--weight-semibold)' }}>+ Create new sim…</span>
                </Combobox.Item>
              </Combobox>

              {tab === 'partner' ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', marginTop: '0.75rem' }}>
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
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '0.75rem' }}>
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
                  disabled={!pickedSim}
                >
                  Add
                </button>
              </div>
            </div>

            {showCreate && (
              <CreateSimModal
                legacyId={legacyId}
                onCreated={handleCreated}
                onClose={() => setShowCreate(false)}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  )
}
