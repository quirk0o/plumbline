/**
 * Split a legacy name so the trailing word "Legacy" can be rendered as an
 * amber accent (e.g. "The Caliente <em>Legacy</em>"). Returns null when the
 * name has no trailing "Legacy", so callers render it plainly.
 */
export function splitLegacyName(
  name: string,
): { before: string; legacy: string } | null {
  const match = name.match(/^(.*)\s(Legacy)$/)
  return match ? { before: match[1], legacy: match[2] } : null
}
