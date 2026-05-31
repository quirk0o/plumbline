import { cn } from '@/lib/utils'
import styles from './stat-block.module.css'

export interface StatBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string | number
  label: React.ReactNode
  /** Overrides the numeral color. Pass a `var(--token)` (e.g. `var(--amber-text)`), never a raw hex. */
  accent?: string
}

export function StatBlock({ value, label, accent, className, ...props }: StatBlockProps) {
  return (
    <div className={cn(styles.container, className)} {...props}>
      <span className={styles.value} style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      <span className={styles.label}>{label}</span>
    </div>
  )
}
