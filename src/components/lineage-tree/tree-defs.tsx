/**
 * SVG <defs> for the lineage tree: the heir-crown plumbob gradient and a soft
 * "lift" drop-shadow filter. Emitted once per SVG. Ids are namespaced by a
 * caller-supplied prefix (from `useId`) so multiple trees on one page never
 * collide.
 */

type TreeDefsProps = {
  /** Unique prefix (e.g. from `React.useId()`) to namespace the def ids. */
  idPrefix: string
}

/** Build the stable def ids for a given prefix. */
export function treeDefIds(idPrefix: string) {
  return {
    plumbobGradient: `${idPrefix}-plumbob`,
  }
}

export function TreeDefs({ idPrefix }: TreeDefsProps) {
  const ids = treeDefIds(idPrefix)
  return (
    <defs>
      {/* Plumbob: the brand's green diamond gradient, used for the heir crown. */}
      <linearGradient id={ids.plumbobGradient} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--green-bright)" />
        <stop offset="100%" stopColor="var(--green)" />
      </linearGradient>
    </defs>
  )
}
