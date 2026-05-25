import { cn } from '@/lib/utils'
import { Eyebrow } from '@/components/ui/eyebrow/eyebrow'
import styles from './section-heading.module.css'

export interface SectionHeadingProps {
  eyebrow: string
  title: string
  blurb?: string
  className?: string
}

export function SectionHeading({ eyebrow, title, blurb, className }: SectionHeadingProps) {
  return (
    <div className={cn(styles.container, className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={styles.title}>{title}</h2>
      {blurb && <p className={styles.blurb}>{blurb}</p>}
    </div>
  )
}
