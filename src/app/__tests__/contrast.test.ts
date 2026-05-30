import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// globals.css is the single source of truth for the design tokens. We parse it
// directly so the contrast guarantee tracks whatever the stylesheet actually
// ships, rather than a duplicated copy of the hex values in the test.
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

/**
 * Extract `--name: #hex;` declarations from every CSS block whose selector
 * matches `selector`. globals.css splits its `:root` tokens across two blocks
 * (primitive colour scale, then semantic tokens), so we accumulate across all
 * matching blocks rather than only the first. Later declarations win, matching
 * the cascade.
 */
function tokensIn(selector: RegExp): Record<string, string> {
  const blockRe = new RegExp(selector.source + '\\s*\\{([\\s\\S]*?)\\}', 'g')
  const out: Record<string, string> = {}
  for (const block of css.matchAll(blockRe)) {
    for (const m of block[1].matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})/g)) {
      out[m[1]] = m[2]
    }
  }
  return out
}

function toRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lin(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map(lin) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function ratio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// Token names confirmed against globals.css: surfaces are --bg / --bg-surface /
// --bg-card (not the design-spec's --surface-*), text is --text-muted /
// --text-subtle, and the dark theme lives under [data-theme="dark"].
const light = tokensIn(/:root/)
const dark = tokensIn(/\[data-theme="dark"\]/)

const AA = 4.5
const surfaces = ['--bg', '--bg-surface', '--bg-card']
const texts = ['--text-muted', '--text-subtle']

describe.each([
  ['light', light],
  ['dark', dark],
])('WCAG AA — %s theme', (_name, tok) => {
  it('resolved the token set from globals.css', () => {
    expect(Object.keys(tok).length).toBeGreaterThan(0)
    for (const t of [...texts, ...surfaces]) {
      expect(tok[t], `${t} missing`).toBeTruthy()
    }
  })

  it.each(texts)('%s meets 4.5:1 on every surface', (text) => {
    for (const surf of surfaces) {
      const r = ratio(tok[text], tok[surf])
      expect(r, `${text} on ${surf} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA)
    }
  })
})
