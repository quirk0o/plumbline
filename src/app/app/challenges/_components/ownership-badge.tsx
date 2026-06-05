import { cn } from '@/lib/utils'
import styles from './ownership-badge.module.css'

/**
 * Category badge for challenge ownership. Like the pack-type badges, these
 * colors are category signals: green = public library, amber = yours.
 */
export function OwnershipBadge({ isYours }: { isYours: boolean }) {
  return (
    <span className={cn(styles.badge, isYours ? styles.yours : styles.public)}>
      {isYours ? 'Yours' : 'Public'}
    </span>
  )
}
