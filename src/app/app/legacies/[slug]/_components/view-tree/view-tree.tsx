'use client'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { TreeIcon } from '@/components/ui'
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

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
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
        />
      )}
    </>
  )
}
