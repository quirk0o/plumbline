import { cn } from '@/lib/utils'
import styles from './badge.module.css'

export type BadgeVariant =
  | 'expansion'
  | 'game'
  | 'stuff'
  | 'kit'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'neutral'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(styles.badge, styles[variant], className)}
      {...props}
    />
  )
}
