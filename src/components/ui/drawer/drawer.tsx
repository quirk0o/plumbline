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

// Wrap Root in our own component before Object.assign: assigning onto
// RadixDialog.Root directly would MUTATE the shared Radix module object,
// so Dialog and Drawer (both built on it) would clobber each other's
// subcomponents — whichever module evaluated last won app-wide.
function DrawerRoot(props: RadixDialog.DialogProps) {
  return <RadixDialog.Root {...props} />
}

export const Drawer = Object.assign(DrawerRoot, {
  Trigger: RadixDialog.Trigger,
  Portal: RadixDialog.Portal,
  Overlay: DrawerOverlay,
  Content: DrawerContent,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: RadixDialog.Close,
})
