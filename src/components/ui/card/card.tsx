import { cn } from '@/lib/utils'
import styles from './card.module.css'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'article' | 'section'
  hoverable?: boolean
  padding?: 'sm' | 'base' | 'lg'
}

export function Card({
  as: Tag = 'div',
  hoverable = false,
  padding = 'base',
  className,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        styles.card,
        styles[padding],
        hoverable && styles.hoverable,
        className,
      )}
      {...props}
    />
  )
}
