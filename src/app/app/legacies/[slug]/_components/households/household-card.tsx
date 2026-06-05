import { ArrowRightIcon } from '@/components/ui'
import type { HouseholdView } from '../../lib/types'
import { simoleons } from './lib'
import { ResidentStack } from './featured-household'
import styles from './households.module.css'

export interface HouseholdCardProps {
  household: HouseholdView
  onManage: () => void
}

/** Compact grid card for a non-playing household. The whole card opens the
 *  management drawer.
 *
 *  Note on structure: an <h4> inside a <button> is invalid HTML. Instead we
 *  use a <div> as the card root (with role="button" and tabIndex) and a
 *  <span role="heading" aria-level={4}> for the name. This satisfies both the
 *  heading assertion (getByRole('heading', { name })) and the button assertion
 *  (getByRole('button', { name: /householdName/ })) in the tests. Block-level
 *  wrappers (the cardTop group + address) are <div>s, not <span>s, since the
 *  root is a <div> and block-in-inline nesting is invalid. The footer holds
 *  only inline content, so it stays a <span>. */
export function HouseholdCard({ household: h, onManage }: HouseholdCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.card}
      onClick={onManage}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onManage()
        }
      }}
      aria-label={h.name}
    >
      <div className={styles.cardTop}>
        <div>
          <span role="heading" aria-level={4} className={styles.cardName}>
            {h.name}
          </span>
          {(h.worldName || h.lot) && (
            <div className={styles.cardAddress}>
              {[h.worldName, h.lot].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        {h.residents.length > 0 ? (
          <ResidentStack residents={h.residents} size={26} max={4} />
        ) : (
          <span className={styles.cardEmptyNote}>Empty lot</span>
        )}
      </div>

      <span className={styles.cardFooter}>
        <span className={styles.cardFunds}>
          <span className={styles.cardFundsValue}>{simoleons(h.funds)}</span>
          <span className={styles.cardResidentCount}>
            {' · '}
            {h.residents.length} resident{h.residents.length === 1 ? '' : 's'}
          </span>
        </span>
        <span className={styles.cardManage}>
          Manage <ArrowRightIcon size={13} />
        </span>
      </span>
    </div>
  )
}
