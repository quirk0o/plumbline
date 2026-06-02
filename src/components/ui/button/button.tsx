import { forwardRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import styles from './button.module.css'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'link' | 'destructive'
  size?: 'sm' | 'base' | 'lg' | 'icon'
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'base', fullWidth = false, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})

export interface ButtonLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'link'
  size?: 'sm' | 'base' | 'lg' | 'icon'
  fullWidth?: boolean
  href: string
}

export function ButtonLink({
  variant = 'primary',
  size = 'base',
  fullWidth = false,
  href,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  )
}
