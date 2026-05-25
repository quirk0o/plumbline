import Link from 'next/link'
import { PortraitAvatar } from '@/components/ui'
import { formatLifeStage } from '@/lib/legacy-format'
import { ringFor } from '../../lib/derive'
import type { ChronicleSim } from '../../lib/types'
import styles from './roster-card.module.css'

export interface RosterCardProps {
  sim: ChronicleSim
  slug: string
}

export function RosterCard({ sim, slug }: RosterCardProps) {
  const roleLabel = sim.isHeir
    ? ' · Heir'
    : sim.isFounder
      ? ' · Founder'
      : ''

  return (
    <li className={styles.item}>
      <Link
        href={`/app/legacies/${slug}/sims/${sim.id}`}
        className={styles.card}
      >
        <PortraitAvatar
          imageUrl={sim.imageUrl}
          firstName={sim.firstName}
          lastName={sim.lastName}
          size={48}
          ring={ringFor(sim)}
        />
        <div className={styles.nameBlock}>
          <span className={styles.name}>
            {sim.firstName} {sim.lastName}
          </span>
          <span className={styles.meta}>
            {formatLifeStage(sim.lifeStage)}{roleLabel}
          </span>
        </div>
      </Link>
    </li>
  )
}
