import { cn } from '@/lib/utils'
import styles from './eyebrow.module.css'

export interface EyebrowProps {
  children: React.ReactNode
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
