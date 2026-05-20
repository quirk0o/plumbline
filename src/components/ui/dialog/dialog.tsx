'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import styles from './dialog.module.css'

export type DialogContentProps = RadixDialog.DialogContentProps & {
  size?: 'sm' | 'base' | 'lg'
}

function DialogOverlay({ className, ...props }: RadixDialog.DialogOverlayProps) {
  return <RadixDialog.Overlay className={cn(styles.overlay, className)} {...props} />
}

function DialogContent({ size = 'base', className, children, ...props }: DialogContentProps) {
  return (
    <RadixDialog.Content
      className={cn(styles.content, size !== 'base' && styles[size], className)}
      {...props}
    >
      {children}
    </RadixDialog.Content>
  )
}

function DialogTitle({ className, ...props }: RadixDialog.DialogTitleProps) {
  return <RadixDialog.Title className={cn(styles.title, className)} {...props} />
}

function DialogDescription({ className, ...props }: RadixDialog.DialogDescriptionProps) {
  return <RadixDialog.Description className={cn(styles.description, className)} {...props} />
}

export const Dialog = Object.assign(RadixDialog.Root, {
  Trigger: RadixDialog.Trigger,
  Portal: RadixDialog.Portal,
  Overlay: DialogOverlay,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: RadixDialog.Close,
})
