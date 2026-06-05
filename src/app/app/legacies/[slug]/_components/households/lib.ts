import type { WorldOption } from '../../lib/types'

/** Simoleon currency formatting: §184,250. */
export function simoleons(n: number): string {
  return '§' + n.toLocaleString('en-US')
}

/**
 * World options for a household's world select. The list is already filtered
 * to owned packs server-side; the household's CURRENT world is merged back in
 * so existing data never disappears from the select (preserve-current rule).
 */
export function worldOptions(
  worlds: WorldOption[],
  current: { worldId: string | null; worldName: string | null },
): WorldOption[] {
  if (!current.worldId || !current.worldName) return worlds
  if (worlds.some((w) => w.id === current.worldId)) return worlds
  return [{ id: current.worldId, name: current.worldName, lots: [] }, ...worlds]
}

/**
 * Lot options for the selected world, with the household's current (possibly
 * custom) lot always offered first.
 */
export function lotOptions(world: WorldOption | undefined, currentLot: string | null): string[] {
  const lots = world?.lots ?? []
  if (currentLot && !lots.includes(currentLot)) return [currentLot, ...lots]
  return lots
}
