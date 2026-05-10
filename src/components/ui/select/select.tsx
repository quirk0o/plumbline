import { cn } from '@/lib/utils'
import styles from './select.module.css'

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  error?: boolean
  size?: 'sm' | 'base' | 'lg'
}

export function Select({ error = false, size = 'base', className, children, ...props }: SelectProps) {
  return (
    <div className={cn(styles.wrapper, size !== 'base' && styles[size])}>
      <select
        className={cn(styles.select, error && styles.error, className)}
        {...props}
      >
        {children}
      </select>
      <span className={styles.chevron} aria-hidden="true">
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  )
}
