import Link from 'next/link'
import { cn } from '@/lib/utils'
import styles from './breadcrumb.module.css'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn(styles.nav, className)}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={index} className={styles.item}>
              {isLast || !item.href ? (
                <span
                  className={isLast ? styles.current : styles.noLink}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className={styles.link}>
                  {item.label}
                </Link>
              )}
              {!isLast && (
                <span className={styles.separator} aria-hidden="true">
                  &rsaquo;
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
