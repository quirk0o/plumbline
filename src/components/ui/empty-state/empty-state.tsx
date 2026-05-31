import { cn } from '@/lib/utils'
import styles from './empty-state.module.css'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional call-to-action rendered below the message (e.g. a ButtonLink). */
  action?: React.ReactNode
}

export function EmptyState({ children, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn(styles.root, className)} {...props}>
      <p className={styles.text}>{children}</p>
      {action}
    </div>
  )
}
