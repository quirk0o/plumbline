import { cn } from '@/lib/utils'
import styles from './ghost-circle.module.css'

export interface GhostCircleProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Diameter in px (width = height). Defaults to 72. */
  size?: number
  /** Amber treatment for founder/heir slots; neutral wheat otherwise. */
  accent?: boolean
}

export function GhostCircle({
  size = 72,
  accent = false,
  className,
  style,
  children,
  ...props
}: GhostCircleProps) {
  return (
    <div
      className={cn(styles.circle, accent && styles.accent, className)}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
      {...props}
    >
      {children}
    </div>
  )
}
