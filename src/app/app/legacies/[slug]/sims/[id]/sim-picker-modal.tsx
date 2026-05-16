'use client'

import Image from 'next/image'
import styles from './page.module.css'

type SimOption = { id: string; firstName: string; lastName: string; imageUrl: string | null }

interface Props {
  sims: SimOption[]
  selected: string | null
  onSelect: (id: string) => void
  title: string
  children?: React.ReactNode
  onConfirm: () => void
  onClose: () => void
  confirmDisabled?: boolean
}

export function SimPickerModal({ sims, selected, onSelect, title, children, onConfirm, onClose, confirmDisabled }: Props) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.modalTitle}>{title}</p>

        <div className={styles.simCards} style={{ maxHeight: '240px', overflowY: 'auto' }}>
          {sims.map((sim) => (
            <button
              key={sim.id}
              className={styles.simCard}
              style={{ background: 'none', border: 'none', cursor: 'pointer', outline: selected === sim.id ? '2px solid var(--green)' : 'none', borderRadius: '50%' }}
              onClick={() => onSelect(sim.id)}
              aria-pressed={selected === sim.id}
            >
              <div className={styles.simPortraitWrap}>
                {sim.imageUrl ? (
                  <Image src={sim.imageUrl} alt={sim.firstName} fill sizes="72px" style={{ objectFit: 'cover' }} />
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

        {children}

        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.editableChip}
            style={{ background: 'var(--green)', color: 'white', borderColor: 'var(--green)' }}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
