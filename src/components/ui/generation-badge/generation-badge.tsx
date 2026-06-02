import { cn } from '@/lib/utils'
import styles from './generation-badge.module.css'

export type GenerationBadgeProps = React.HTMLAttributes<HTMLSpanElement>

export function GenerationBadge({ children, className, ...props }: GenerationBadgeProps) {
  return (
    <span className={cn(styles.badge, className)} {...props}>
      {children}
    </span>
  )
}
