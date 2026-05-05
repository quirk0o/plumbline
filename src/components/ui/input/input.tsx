import { cn } from '@/lib/utils'
import styles from './input.module.css'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error = false, className, ...props }: InputProps) {
  return (
    <input
      className={cn(styles.input, error && styles.error, className)}
      {...props}
    />
  )
}
