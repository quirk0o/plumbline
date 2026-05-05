import { cn } from '@/lib/utils'
import styles from './form-field.module.css'

export interface FormFieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn(styles.field, className)}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  )
}
