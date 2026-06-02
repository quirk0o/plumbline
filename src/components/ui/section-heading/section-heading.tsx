import { cn } from '@/lib/utils'
import { Eyebrow } from '@/components/ui/eyebrow/eyebrow'
import styles from './section-heading.module.css'

export interface SectionHeadingProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow: React.ReactNode
  title: React.ReactNode
  blurb?: React.ReactNode
}

export function SectionHeading({
  eyebrow,
  title,
  blurb,
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div className={cn(styles.container, className)} {...props}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={styles.title}>{title}</h2>
      {blurb && <p className={styles.blurb}>{blurb}</p>}
    </div>
  )
}
