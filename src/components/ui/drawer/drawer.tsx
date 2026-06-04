'use client'

import * as RadixDialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'
import styles from './drawer.module.css'

export type DrawerContentProps = RadixDialog.DialogContentProps & {
  side?: 'right'
}

function DrawerOverlay({ className, ...props }: RadixDialog.DialogOverlayProps) {
  return <RadixDialog.Overlay className={cn(styles.overlay, className)} {...props} />
}

function DrawerContent({ side = 'right', className, children, ...props }: DrawerContentProps) {
  return (
    <RadixDialog.Content className={cn(styles.content, styles[side], className)} {...props}>
      {children}
    </RadixDialog.Content>
  )
}

function DrawerTitle({ className, ...props }: RadixDialog.DialogTitleProps) {
  return <RadixDialog.Title className={cn(styles.title, className)} {...props} />
}

function DrawerDescription({ className, ...props }: RadixDialog.DialogDescriptionProps) {
  return <RadixDialog.Description className={cn(styles.description, className)} {...props} />
}

export const Drawer = Object.assign(RadixDialog.Root, {
  Trigger: RadixDialog.Trigger,
  Portal: RadixDialog.Portal,
  Overlay: DrawerOverlay,
  Content: DrawerContent,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: RadixDialog.Close,
})
