'use client'
import { useRef, useState } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { Button, TreeIcon } from '@/components/ui'
import { TreeOverlay } from '../tree-overlay/tree-overlay'

export interface ViewTreeProps {
  legacySlug: string
  legacyName: string
  founderSimId?: string
  name: string | null
  email: string | null
  image: string | null
}

export function ViewTree({
  legacySlug,
  legacyName,
  founderSimId,
  name,
  email,
  image,
}: ViewTreeProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        onClick={(e) => {
          triggerRef.current = e.currentTarget
          setOpen(true)
        }}
      >
        <TreeIcon />
        View family tree
      </Button>
      {open && (
        <TreeOverlay
          legacySlug={legacySlug}
          legacyName={legacyName}
          founderSimId={founderSimId}
          name={name}
          email={email}
          image={image}
          onClose={() => setOpen(false)}
          returnFocusRef={triggerRef}
        />
      )}
    </RadixDialog.Root>
  )
}
