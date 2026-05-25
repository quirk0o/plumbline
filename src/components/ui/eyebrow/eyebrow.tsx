import { cn } from '@/lib/utils'
import styles from './eyebrow.module.css'

export interface EyebrowProps {
  children: React.ReactNode
  /** Overrides the label color. Pass a `var(--token)` (e.g. heir amber), never a raw hex. */
  color?: string
  className?: string
}

export function Eyebrow({ children, color, className }: EyebrowProps) {
  return (
    <p
      className={cn(styles.eyebrow, className)}
      style={color ? { color } : undefined}
    >
      {children}
    </p>
  )
}
