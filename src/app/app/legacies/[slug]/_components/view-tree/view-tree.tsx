import { ButtonLink, TreeIcon } from '@/components/ui'

export interface ViewTreeProps {
  legacySlug: string
}

/** Hero CTA that links to the full-page family-tree Atlas route. */
export function ViewTree({ legacySlug }: ViewTreeProps) {
  return (
    <ButtonLink href={`/app/legacies/${legacySlug}/tree`} variant="outline">
      <TreeIcon />
      View family tree
    </ButtonLink>
  )
}
