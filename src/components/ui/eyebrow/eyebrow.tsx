import { cn } from '@/lib/utils'
import styles from './eyebrow.module.css'

export interface EyebrowProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Overrides the label color. Pass a `var(--token)` (e.g. `var(--amber-text)`), never a raw hex. */
  color?: string
}

export function Eyebrow({ children, color, className, style, ...props }: EyebrowProps) {
  return (
    <p
      className={cn(styles.eyebrow, className)}
      style={color ? { ...style, color } : style}
      {...props}
    >
      {children}
    </p>
  )
}
