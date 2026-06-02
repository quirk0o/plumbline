import { cn } from '@/lib/utils'
import { GhostCircle } from '@/components/ui/ghost-circle/ghost-circle'
import styles from './empty-state.module.css'

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Lucide-style icon node; rendered inside a 72px GhostCircle. */
  icon?: React.ReactNode
  /** Serif headline. May contain one italic <em> accent word. */
  title?: React.ReactNode
  /** Amber GhostCircle (founder/heir context) instead of neutral wheat. */
  accent?: boolean
  /** Call-to-action rendered below the body (e.g. a Button / ButtonLink). */
  action?: React.ReactNode
}

export function EmptyState({
  icon,
  title,
  accent,
  action,
  children,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div className={cn(styles.root, className)} {...props}>
      {icon && (
        <GhostCircle accent={accent} size={72}>
          {icon}
        </GhostCircle>
      )}
      {title && <h3 className={styles.title}>{title}</h3>}
      {children && <p className={styles.body}>{children}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
