import { cn } from '@/lib/utils'
import styles from './stat-block.module.css'

export interface StatBlockProps {
  value: string | number
  label: string
  /** Overrides the numeral color. Pass a `var(--token)` (e.g. amber), never a raw hex. */
  accent?: string
  className?: string
}

export function StatBlock({ value, label, accent, className }: StatBlockProps) {
  return (
    <div className={cn(styles.container, className)}>
      <span
        className={styles.value}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
