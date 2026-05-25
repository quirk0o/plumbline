import { cn } from '@/lib/utils'
import styles from './generation-badge.module.css'

export interface GenerationBadgeProps {
  children: React.ReactNode
  className?: string
}

export function GenerationBadge({ children, className }: GenerationBadgeProps) {
  return (
    <span className={cn(styles.badge, className)}>
      {children}
    </span>
  )
}
