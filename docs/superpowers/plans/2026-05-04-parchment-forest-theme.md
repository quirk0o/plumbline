# Parchment & Forest Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark editorial theme with the warm "Parchment & Forest" light theme, full design token system, and a light/dark mode toggle persisted to localStorage.

**Architecture:** All colours, radii, and shadows become CSS custom properties defined in `globals.css`. Light values live on `:root`; dark values override them under `[data-theme="dark"]` on `<html>`. A `ThemeProvider` client component owns toggle state and writes `data-theme`; an inline flash-prevention `<script>` in `<head>` reads `localStorage` before first paint to eliminate flicker.

**Tech Stack:** Next.js 16, React 19, CSS Modules, next/font/google (Plus Jakarta Sans + Cormorant Garamond), localStorage for persistence.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/app/globals.css` | Modify | Full token layer: primitives, semantic, dark override |
| `src/components/Plumbob.tsx` | Create | Shared `<Plumbob>` + `<MiniPlumbob>` with CSS-var facets |
| `src/components/ThemeProvider.tsx` | Create | Theme context, `useTheme()`, `<ThemeToggle>` button |
| `src/app/layout.tsx` | Modify | Font swap, flash-prevention script, `<ThemeProvider>` wrapper |
| `src/app/app/components/AppNav.tsx` | Modify | Use shared `<MiniPlumbob>`, add `<ThemeToggle>` |
| `src/app/app/components/AppNav.module.css` | Modify | Replace all hardcoded values with tokens |
| `src/app/page.tsx` | Modify | Use shared `<Plumbob>` / `<MiniPlumbob>`, add `<ThemeToggle>` to nav |
| `src/app/page.module.css` | Modify | Replace all hardcoded values with tokens |
| `src/app/auth/signin/page.tsx` | Modify | Replace CSS-div plumbob with `<MiniPlumbob>` |
| `src/app/auth/signin/signin.module.css` | Modify | Remove rotated-div styles, replace all values with tokens |
| `src/app/app/page.module.css` | Modify | Replace hardcoded `rgba(237,250,240,…)` with tokens |
| `src/app/app/onboarding/packs/page.module.css` | Modify | Replace hardcoded values with tokens |
| `src/app/app/settings/packs/page.module.css` | Modify | Replace hardcoded values with tokens |
| `src/app/components/PackGrid.module.css` | Modify | Replace all hardcoded values; use pack-type tokens |

---

## Task 1: CSS Token Foundation

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace globals.css with the full token system**

Replace the entire file content:

```css
/* ─── Primitive colour scale ──────────────────────────────────── */
:root {
  --color-green-50:  #f0faf4;
  --color-green-100: #dcf4e8;
  --color-green-200: #b6e8c8;
  --color-green-400: #4aaf72;
  --color-green-600: #22874c;
  --color-green-700: #1e7040;
  --color-green-800: #1a5c35;
  --color-green-900: #0d3320;

  --color-amber-50:  #fffbeb;
  --color-amber-100: #fef3c7;
  --color-amber-200: #fde68a;
  --color-amber-400: #fbbf24;
  --color-amber-600: #d4a017;
  --color-amber-700: #b45309;
  --color-amber-900: #78400a;
}

/* ─── Semantic tokens — light (Parchment) ─────────────────────── */
:root {
  /* Backgrounds */
  --bg:            #faf7f0;
  --bg-surface:    #fefcf7;
  --bg-card:       #ffffff;
  --bg-card-hover: #fdfbf5;

  /* Borders */
  --border:        #e8dfc8;
  --border-bright: #c8b896;

  /* Text — all meet WCAG AA */
  --text:        #2a1f0e;
  --text-muted:  #8c7a5e;
  --text-subtle: #b8a88a;

  /* Green accent (interactive only) */
  --green:        var(--color-green-800);
  --green-bright: var(--color-green-600);
  --green-glow:   rgba(26, 92, 53, 0.12);

  /* Amber accent (legacy/heir callouts only) */
  --amber:        var(--color-amber-600);

  /* Pack type badge colours */
  --pack-expansion:   var(--color-green-400);
  --pack-game:        var(--color-amber-400);
  --pack-stuff:       #c4b5fd;
  --pack-kit:         #fda4af;
  --pack-badge-text:  var(--bg);
  --pack-card-footer: rgba(0, 0, 0, 0.04);

  /* Plumbob facets */
  --plumbob-tl: #86efac;
  --plumbob-tr: #22c55e;
  --plumbob-bl: #166f4a;
  --plumbob-br: #0a4530;

  /* Radius scale */
  --radius-xs:   4px;
  --radius-sm:   6px;
  --radius-base: 8px;
  --radius-md:   10px;
  --radius-lg:   14px;
  --radius-xl:   20px;

  /* Shadow scale */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.10);

  /* Typography */
  --font-display: var(--font-cormorant), 'Cormorant Garamond', Georgia, serif;
  --font-body:    var(--font-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif;
}

/* ─── Semantic tokens — dark (Forest Night) ───────────────────── */
[data-theme="dark"] {
  --bg:            #0c1510;
  --bg-surface:    #111d14;
  --bg-card:       #162219;
  --bg-card-hover: #1c2a1f;

  --border:        rgba(255, 255, 255, 0.08);
  --border-bright: rgba(255, 255, 255, 0.15);

  --text:        #f0ede8;
  --text-muted:  #a09488;
  --text-subtle: #6e6258;

  --green:        #4aaf72;
  --green-bright: #6dc98e;
  --green-glow:   rgba(74, 175, 114, 0.15);

  --amber:        #fbbf24;

  --pack-expansion:   #4aaf72;
  --pack-game:        #fbbf24;
  --pack-badge-text:  #0c1510;
  --pack-card-footer: rgba(0, 0, 0, 0.22);

  --plumbob-tl: #a7f3c0;
  --plumbob-tr: #34d399;
  --plumbob-bl: #166f4a;
  --plumbob-br: #0a4530;

  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.20);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.30);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.40);
}

/* ─── Base resets ─────────────────────────────────────────────── */
html {
  height: 100%;
  scroll-behavior: smooth;
}

html, body {
  max-width: 100vw;
  overflow-x: hidden;
}

body {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--text);
  background: var(--bg);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

a {
  color: inherit;
  text-decoration: none;
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (globals.css changes don't affect TS).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): add Parchment & Forest CSS token system"
```

---

## Task 2: Shared Plumbob Component

**Files:**
- Create: `src/components/Plumbob.tsx`

- [ ] **Step 1: Create the shared component**

```tsx
// src/components/Plumbob.tsx

interface PlumbobProps {
  width?: number
}

export function Plumbob({ width = 260 }: PlumbobProps) {
  const height = Math.round(width * 1.1)
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 110"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon points="50,5 5,57 50,66"   fill="var(--plumbob-tl)" />
      <polygon points="50,5 95,57 50,66"  fill="var(--plumbob-tr)" />
      <polygon points="50,105 5,57 50,66" fill="var(--plumbob-bl)" />
      <polygon points="50,105 95,57 50,66" fill="var(--plumbob-br)" />
      <polygon points="50,5 5,57 27,31"   fill="rgba(255,255,255,0.16)" />
      <line x1="50" y1="5"  x2="50" y2="105" stroke="rgba(0,0,0,0.08)" strokeWidth="0.6" />
      <line x1="5"  y1="57" x2="95" y2="57"  stroke="rgba(0,0,0,0.08)" strokeWidth="0.6" />
    </svg>
  )
}

export function MiniPlumbob() {
  return (
    <svg
      width="14"
      height="15"
      viewBox="0 0 100 110"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon points="50,5 5,57 50,66"   fill="var(--plumbob-tl)" />
      <polygon points="50,5 95,57 50,66"  fill="var(--plumbob-tr)" />
      <polygon points="50,105 5,57 50,66" fill="var(--plumbob-bl)" />
      <polygon points="50,105 95,57 50,66" fill="var(--plumbob-br)" />
    </svg>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/Plumbob.tsx
git commit -m "feat(theme): add shared Plumbob component with CSS-var facets"
```

---

## Task 3: ThemeProvider, Flash-Prevention Script, and Font Swap

**Files:**
- Create: `src/components/ThemeProvider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create ThemeProvider**

```tsx
// src/components/ThemeProvider.tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const stored = localStorage.getItem('simstrack-theme') as Theme | null
    const resolved: Theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    setTheme(resolved)
    document.documentElement.setAttribute('data-theme', resolved)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('simstrack-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        color: 'var(--text-muted)',
        borderRadius: 'var(--radius-sm)',
        transition: 'color 0.15s',
      }}
    >
      {theme === 'light' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Update layout.tsx — font swap, flash script, ThemeProvider**

Replace the entire file:

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { TRPCProvider } from '@/trpc/Provider'
import { ThemeProvider } from '@/components/ThemeProvider'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SimsTrack',
  description: 'Chronicle your Sims legacies — track every generation, household, and story.',
}

const flashPreventionScript = `(function(){try{var t=localStorage.getItem('simstrack-theme');var r=t==='dark'||t==='light'?t:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',r);}catch(e){}})();`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jakarta.variable}`} data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: flashPreventionScript }} />
      </head>
      <body>
        <SessionProvider>
          <TRPCProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </TRPCProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start the dev server and verify no flash on reload**

```bash
npm run dev
```

Open http://localhost:3000. Hard-reload (Cmd+Shift+R) several times. The page should not flash between light and dark. Toggle the theme in the browser console:

```js
localStorage.setItem('simstrack-theme', 'dark'); location.reload();
```

Expected: page loads dark immediately with no white flash. Reset with:

```js
localStorage.removeItem('simstrack-theme'); location.reload();
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ThemeProvider.tsx src/app/layout.tsx
git commit -m "feat(theme): add ThemeProvider, flash-prevention script, swap to Plus Jakarta Sans"
```

---

## Task 4: AppNav — Theme Toggle + Token Cleanup

**Files:**
- Modify: `src/app/app/components/AppNav.tsx`
- Modify: `src/app/app/components/AppNav.module.css`

- [ ] **Step 1: Update AppNav.tsx**

Replace the entire file:

```tsx
// src/app/app/components/AppNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { MiniPlumbob } from '@/components/Plumbob'
import { ThemeToggle } from '@/components/ThemeProvider'
import styles from './AppNav.module.css'

interface AppNavProps {
  name: string | null
  email: string | null
  image: string | null
}

export function AppNav({ name, email, image }: AppNavProps) {
  const pathname = usePathname()
  const initial = (name ?? email ?? '?')[0].toUpperCase()

  const isActive = (href: string) =>
    href === '/app' ? pathname === '/app' : pathname.startsWith(href)

  return (
    <nav className={styles.nav}>
      <Link href="/app" className={styles.logo}>
        <MiniPlumbob />
        SimsTrack
      </Link>

      <div className={styles.links}>
        <Link
          href="/app"
          className={`${styles.link} ${isActive('/app') ? styles.linkActive : ''}`}
        >
          Dashboard
        </Link>
        <Link
          href="/app/settings/packs"
          className={`${styles.link} ${isActive('/app/settings') ? styles.linkActive : ''}`}
        >
          Settings
        </Link>
      </div>

      <div className={styles.user}>
        <ThemeToggle />
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name ?? ''} className={styles.avatar} />
        ) : (
          <div className={styles.avatarInitial}>{initial}</div>
        )}
        <button
          className={styles.signOut}
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Replace AppNav.module.css**

```css
/* src/app/app/components/AppNav.module.css */

.nav {
  height: 48px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  gap: 1.5rem;
  position: sticky;
  top: 0;
  z-index: 10;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  text-decoration: none;
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

.links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.125rem;
  flex: 1;
}

.link {
  padding: 0.3rem 0.625rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.12s, background 0.12s;
}

.link:hover {
  color: var(--text);
  background: var(--bg-card-hover);
}

.linkActive {
  color: var(--green) !important;
  background: var(--green-glow) !important;
}

.user {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  flex-shrink: 0;
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border-bright);
}

.avatarInitial {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--green-glow);
  border: 1px solid var(--border-bright);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--green);
}

.signOut {
  font-size: 0.68rem;
  color: var(--text-subtle);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  transition: color 0.12s;
  padding: 0;
}

.signOut:hover {
  color: var(--text-muted);
}
```

- [ ] **Step 3: Check TypeScript and visual**

```bash
npx tsc --noEmit
```

Navigate to http://localhost:3000/app (sign in if needed). Verify:
- Nav renders with the new light background and warm border
- Moon icon appears; clicking it switches to dark mode
- Active nav link shows green
- No console errors

- [ ] **Step 4: Commit**

```bash
git add src/app/app/components/AppNav.tsx src/app/app/components/AppNav.module.css
git commit -m "feat(theme): update AppNav with theme toggle and token-based styles"
```

---

## Task 5: Landing Page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.module.css`

- [ ] **Step 1: Update page.tsx**

Replace the entire file:

```tsx
// src/app/page.tsx
import Link from 'next/link'
import { Plumbob, MiniPlumbob } from '@/components/Plumbob'
import { ThemeToggle } from '@/components/ThemeProvider'
import styles from './page.module.css'

const features = [
  {
    title: 'Legacy Chronicles',
    description: 'Document multi-generational family sagas from the founding Sim all the way to the tenth heir and beyond.',
  },
  {
    title: 'Sim Profiles',
    description: 'Rich character sheets capturing life stage, gender, occult type, cause of death, and every identity detail.',
  },
  {
    title: 'Family Trees',
    description: 'Map biological, adoptive, and step-family bonds — and visualize how each generation connects.',
  },
  {
    title: 'Skills & Careers',
    description: 'Track skill levels, career branches, and every professional milestone across your Sims\' working lives.',
  },
  {
    title: 'Traits & Aspirations',
    description: 'Record personality traits, bonus traits from aspirations, and mark completed aspiration milestones.',
  },
  {
    title: 'Social Bonds',
    description: 'Chronicle friendships, romances, engagements, marriages — and every heartbreak and rivalry.',
  },
]

export default function Home() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <MiniPlumbob />
          <span>SimsTrack</span>
        </div>
        <div className={styles.navRight}>
          <ThemeToggle />
          <Link href="/auth/signin" className={styles.navSignIn}>
            Sign in
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>
            <MiniPlumbob />
            Legacy Challenge Companion
          </p>
          <h1 className={styles.headline}>
            Every generation,<br />
            every <em>story.</em>
          </h1>
          <p className={styles.description}>
            SimsTrack is your dedicated chronicle for Sims legacies.
            Track every Sim, household, relationship, and milestone
            across generations of gameplay — nothing forgotten, everything remembered.
          </p>
          <Link href="/auth/signin" className={styles.ctaButton}>
            Start your chronicle
            <span className={styles.ctaArrow}>→</span>
          </Link>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.glowOuter} />
          <div className={styles.glowInner} />
          <div className={styles.plumbobWrapper}>
            <Plumbob width={260} />
          </div>
        </div>
      </section>

      <div className={styles.sectionDivider}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerGem}><MiniPlumbob /></span>
        <span className={styles.dividerLine} />
      </div>

      <section className={styles.features}>
        <header className={styles.featuresHeader}>
          <h2 className={styles.featuresTitle}>Everything your legacy deserves</h2>
          <p className={styles.featuresSubtitle}>Built for the Simmer who leaves nothing untracked.</p>
        </header>
        <div className={styles.featuresGrid}>
          {features.map((feature) => (
            <article key={feature.title} className={styles.featureCard}>
              <div className={styles.featureGem}><MiniPlumbob /></div>
              <h3 className={styles.featureName}>{feature.title}</h3>
              <p className={styles.featureDesc}>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaDecor}>
          <div className={styles.ctaGlow} />
          <Plumbob width={80} />
        </div>
        <h2 className={styles.ctaTitle}>Begin your legacy today.</h2>
        <p className={styles.ctaSubtitle}>Free to use. Your stories, always remembered.</p>
        <Link href="/auth/signin" className={styles.ctaButton}>
          Get started
          <span className={styles.ctaArrow}>→</span>
        </Link>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <MiniPlumbob />
          <span>SimsTrack</span>
        </div>
        <p className={styles.footerCopy}>© 2026</p>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Replace page.module.css**

```css
/* src/app/page.module.css */

/* ─── Page shell ──────────────────────────────────────────────── */
.page {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

/* ─── Nav ─────────────────────────────────────────────────────── */
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 5vw;
  backdrop-filter: blur(16px);
  background: rgba(250, 247, 240, 0.88);
  border-bottom: 1px solid var(--border);
}

[data-theme="dark"] .nav {
  background: rgba(12, 21, 16, 0.88);
}

.navLogo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text);
}

.navRight {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.navSignIn {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-muted);
  padding: 0.5rem 1.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}

.navSignIn:hover {
  color: var(--text);
  border-color: var(--border-bright);
  background: var(--bg-card-hover);
}

/* ─── Hero ────────────────────────────────────────────────────── */
.hero {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  min-height: calc(100vh - 65px);
  padding: 5rem 5vw 4rem;
  gap: 3rem;
}

.heroContent {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  animation: fadeUp 0.7s ease-out both;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--green);
  animation: fadeUp 0.7s ease-out 0.05s both;
}

.headline {
  font-family: var(--font-display);
  font-size: clamp(3.2rem, 6vw, 6.5rem);
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: -0.025em;
  color: var(--text);
  animation: fadeUp 0.7s ease-out 0.12s both;
}

.headline em {
  font-style: italic;
  color: var(--green);
}

.description {
  font-family: var(--font-body);
  font-size: 1.0625rem;
  line-height: 1.75;
  color: var(--text-muted);
  max-width: 460px;
  animation: fadeUp 0.7s ease-out 0.2s both;
}

.ctaButton {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  font-family: var(--font-body);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--bg);
  background: var(--green);
  padding: 0.875rem 1.875rem;
  border-radius: var(--radius-base);
  width: fit-content;
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  animation: fadeUp 0.7s ease-out 0.28s both;
}

.ctaButton:hover {
  background: var(--green-bright);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.ctaArrow {
  display: inline-block;
  transition: transform 0.2s;
}

.ctaButton:hover .ctaArrow {
  transform: translateX(5px);
}

/* ─── Hero visual ─────────────────────────────────────────────── */
.heroVisual {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: fadeIn 1s ease-out 0.2s both;
}

.glowOuter {
  position: absolute;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--green-glow) 0%, transparent 70%);
  animation: breathe 5s ease-in-out infinite;
}

.glowInner {
  position: absolute;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--green-glow) 0%, transparent 70%);
  animation: breathe 5s ease-in-out 0.8s infinite;
}

.plumbobWrapper {
  position: relative;
  z-index: 1;
  filter:
    drop-shadow(0 0 20px rgba(26, 92, 53, 0.3))
    drop-shadow(0 0 60px rgba(26, 92, 53, 0.1));
  animation: floatSway 8s ease-in-out infinite;
}

[data-theme="dark"] .plumbobWrapper {
  filter:
    drop-shadow(0 0 20px rgba(74, 175, 114, 0.55))
    drop-shadow(0 0 60px rgba(74, 175, 114, 0.2));
}

/* ─── Divider ─────────────────────────────────────────────────── */
.sectionDivider {
  display: flex;
  align-items: center;
  padding: 0 5vw;
}

.dividerLine {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--border), transparent);
}

.dividerGem {
  padding: 0 1.25rem;
  display: flex;
  align-items: center;
  opacity: 0.6;
}

/* ─── Features ────────────────────────────────────────────────── */
.features {
  padding: 6rem 5vw 7rem;
}

.featuresHeader {
  text-align: center;
  margin-bottom: 4rem;
}

.featuresTitle {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 3.25rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  margin-bottom: 0.875rem;
}

.featuresSubtitle {
  font-family: var(--font-body);
  font-size: 1.0625rem;
  color: var(--text-muted);
}

.featuresGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
}

.featureCard {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 0.3s, background 0.3s, transform 0.3s, box-shadow 0.3s;
}

.featureCard:hover {
  border-color: var(--border-bright);
  background: var(--bg-card-hover);
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.featureGem {
  display: flex;
  margin-bottom: 0.25rem;
}

.featureName {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
}

.featureDesc {
  font-family: var(--font-body);
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--text-muted);
}

/* ─── CTA section ─────────────────────────────────────────────── */
.ctaSection {
  border-top: 1px solid var(--border);
  padding: 7rem 5vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  text-align: center;
}

.ctaDecor {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.ctaGlow {
  position: absolute;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--green-glow) 0%, transparent 70%);
  animation: breathe 4s ease-in-out infinite;
}

.ctaDecor > svg {
  position: relative;
  z-index: 1;
  filter:
    drop-shadow(0 0 12px rgba(26, 92, 53, 0.3))
    drop-shadow(0 0 32px rgba(26, 92, 53, 0.1));
  animation: floatSway 8s ease-in-out infinite;
}

[data-theme="dark"] .ctaDecor > svg {
  filter:
    drop-shadow(0 0 12px rgba(74, 175, 114, 0.6))
    drop-shadow(0 0 32px rgba(74, 175, 114, 0.25));
}

.ctaTitle {
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 5vw, 5rem);
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--text);
}

.ctaSubtitle {
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
}

/* ─── Footer ──────────────────────────────────────────────────── */
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.75rem 5vw;
  border-top: 1px solid var(--border);
}

.footerLogo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.03em;
}

.footerCopy {
  font-family: var(--font-body);
  font-size: 0.8125rem;
  color: var(--text-subtle);
}

/* ─── Animations ──────────────────────────────────────────────── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%       { transform: scale(1.12); opacity: 0.65; }
}

@keyframes floatSway {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  35%       { transform: translateY(-12px) rotate(2.5deg); }
  70%       { transform: translateY(-6px) rotate(-1.5deg); }
}

/* ─── Responsive ──────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .featuresGrid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .hero {
    grid-template-columns: 1fr;
    min-height: auto;
    padding: 3.5rem 5vw 4rem;
    gap: 3.5rem;
  }
  .heroVisual { order: -1; }
  .glowOuter  { width: 240px; height: 240px; }
  .glowInner  { width: 160px; height: 160px; }
  .featuresGrid { grid-template-columns: 1fr; }
  .ctaSection { padding: 5rem 5vw; }
}
```

- [ ] **Step 3: Check TypeScript and visual**

```bash
npx tsc --noEmit
```

Open http://localhost:3000. Verify: parchment background, forest green headline em, plumbob glow is warm-green not cold, toggle button in nav works, dark mode applies Forest Night correctly.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/page.module.css
git commit -m "feat(theme): update landing page with Parchment & Forest tokens"
```

---

## Task 6: Sign-In Page

**Files:**
- Modify: `src/app/auth/signin/page.tsx`
- Modify: `src/app/auth/signin/signin.module.css`

- [ ] **Step 1: Update signin/page.tsx — replace CSS plumbob with shared component**

```tsx
// src/app/auth/signin/page.tsx
import { Suspense } from 'react'
import SignInForm from './SignInForm'
import { MiniPlumbob } from '@/components/Plumbob'
import styles from './signin.module.css'

export default function SignInPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.plumbobWrap}>
          <MiniPlumbob />
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>SimsTrack</h1>
          <p className={styles.subtitle}>Your Sims universe, tracked</p>
        </div>

        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Replace signin.module.css**

```css
/* src/app/auth/signin/signin.module.css */

.page {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 400px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 3rem 2.5rem;
  box-shadow: var(--shadow-lg);
  animation: fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

.plumbobWrap {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
  animation: fadeUp 0.7s 0.1s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Scale up the MiniPlumbob for the sign-in context */
.plumbobWrap svg {
  width: 44px;
  height: 48px;
}

.header {
  text-align: center;
  margin-bottom: 2.5rem;
  animation: fadeUp 0.7s 0.15s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.title {
  font-family: var(--font-display);
  font-size: 2.75rem;
  font-weight: 500;
  font-style: italic;
  letter-spacing: -0.01em;
  color: var(--text);
  line-height: 1;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--text-subtle);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.form {
  animation: fadeUp 0.7s 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.googleButton {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.8125rem 1.25rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, transform 0.18s, box-shadow 0.18s;
  letter-spacing: 0.01em;
}

.googleButton:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-bright);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.googleIcon {
  flex-shrink: 0;
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin: 1.25rem 0;
}

.dividerLine {
  flex: 1;
  height: 1px;
  background: var(--border);
}

.dividerText {
  font-family: var(--font-body);
  font-size: 0.6875rem;
  color: var(--text-subtle);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.emailForm {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.input {
  width: 100%;
  padding: 0.8125rem 1rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 0.9rem;
  transition: border-color 0.18s, box-shadow 0.18s;
  outline: none;
}

.input::placeholder {
  color: var(--text-subtle);
}

.input:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px var(--green-glow);
}

.submitButton {
  width: 100%;
  padding: 0.8125rem;
  background: var(--green);
  border: none;
  border-radius: var(--radius-base);
  color: var(--bg);
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.18s, transform 0.18s, box-shadow 0.18s;
}

.submitButton:hover {
  background: var(--green-bright);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.success {
  text-align: center;
  padding: 1rem 0;
}

.successIcon {
  font-size: 2rem;
  margin-bottom: 1rem;
  display: block;
}

.successTitle {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-style: italic;
  color: var(--text);
  margin-bottom: 0.5rem;
}

.successText {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.6;
}

.error {
  color: #b91c1c;
  font-family: var(--font-body);
  font-size: 0.8125rem;
  text-align: center;
  margin-bottom: 1.25rem;
  padding: 0.6875rem 1rem;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-base);
}

[data-theme="dark"] .error {
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.08);
  border-color: rgba(248, 113, 113, 0.18);
}
```

- [ ] **Step 3: Check TypeScript and visual**

```bash
npx tsc --noEmit
```

Open http://localhost:3000/auth/signin. Verify: card uses warm white background, plumbob SVG renders (no CSS diamond), inputs have correct border/focus styles, dark mode works.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/signin/page.tsx src/app/auth/signin/signin.module.css
git commit -m "feat(theme): update sign-in page — shared Plumbob, token-based styles"
```

---

## Task 7: Dashboard Page

**Files:**
- Modify: `src/app/app/page.module.css`

- [ ] **Step 1: Replace app/page.module.css**

```css
/* src/app/app/page.module.css */

.page {
  max-width: 900px;
  margin: 0 auto;
  padding: 2.5rem 2rem 4rem;
}

.greeting {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 600;
  font-style: italic;
  color: var(--text);
  margin-bottom: 2rem;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
  margin-bottom: 2.5rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1.25rem 1.5rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.card:hover {
  border-color: var(--border-bright);
  background: var(--bg-card-hover);
  box-shadow: var(--shadow-md);
}

.cardLabel {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-subtle);
}

.cardValue {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text);
}

.cardAction {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--green);
  margin-top: 0.25rem;
}

.placeholder {
  font-size: 0.875rem;
  color: var(--text-subtle);
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
```

Open http://localhost:3000/app. Verify card labels, values, and action links render correctly in both light and dark modes.

```bash
git add src/app/app/page.module.css
git commit -m "feat(theme): update dashboard page with token-based styles"
```

---

## Task 8: Onboarding and Settings Pages

**Files:**
- Modify: `src/app/app/onboarding/packs/page.module.css`
- Modify: `src/app/app/settings/packs/page.module.css`

- [ ] **Step 1: Replace onboarding/packs/page.module.css**

```css
/* src/app/app/onboarding/packs/page.module.css */

.page {
  min-height: 100vh;
  padding: 3rem 2rem 4rem;
  max-width: 900px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.stepLabel {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-subtle);
  margin-bottom: 0.5rem;
}

.title {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.2;
  margin-bottom: 0.4rem;
}

.subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.ctaRow {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-top: 1.75rem;
}

.btnContinue {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.65rem 1.375rem;
  background: var(--green);
  color: var(--bg);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 0.8125rem;
  border-radius: var(--radius-base);
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.18s ease, transform 0.18s ease;
}

.btnContinue:hover {
  background: var(--green-bright);
  transform: translateY(-1px);
}

.btnSkip {
  font-size: 0.75rem;
  color: var(--text-subtle);
  text-decoration: underline;
  text-underline-offset: 3px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  transition: color 0.15s;
}

.btnSkip:hover {
  color: var(--text-muted);
}
```

- [ ] **Step 2: Replace settings/packs/page.module.css**

```css
/* src/app/app/settings/packs/page.module.css */

.page {
  min-height: 100vh;
  padding: 3rem 2rem 4rem;
  max-width: 900px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
}

.title {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.2;
  margin-bottom: 0.4rem;
}

.subtitle {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
```

Open http://localhost:3000/app/onboarding/packs and http://localhost:3000/app/settings/packs. Check text colours in both modes.

```bash
git add src/app/app/onboarding/packs/page.module.css src/app/app/settings/packs/page.module.css
git commit -m "feat(theme): update onboarding and settings pages with token-based styles"
```

---

## Task 9: PackGrid

**Files:**
- Modify: `src/app/components/PackGrid.module.css`

- [ ] **Step 1: Replace PackGrid.module.css**

```css
/* src/app/components/PackGrid.module.css */

.root {
  width: 100%;
}

/* ── Section ── */
.section {
  margin-bottom: 2rem;
}

.sectionHeader {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.sectionTitle {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-subtle);
}

.sectionCount {
  font-size: 0.65rem;
  color: var(--text-subtle);
  opacity: 0.6;
}

/* ── Grid ── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 0.375rem;
}

/* ── Card ── */
.card {
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-card);
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
  position: relative;
  user-select: none;
}

.card:hover {
  transform: translateY(-1px);
  border-color: var(--border-bright);
  box-shadow: var(--shadow-md);
}

.cardOwned {
  border-color: var(--border-bright) !important;
}

/* ── Cover ── */
.cover {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.35rem;
  transition: opacity 0.12s ease;
  position: relative;
  overflow: hidden;
}

.coverImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  inset: 0;
}

.coverEmoji {
  position: relative;
  z-index: 1;
}

.coverDimmed {
  opacity: 0.32;
}

/* ── Badge ── */
.badge {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5rem;
  font-weight: 800;
  color: var(--pack-badge-text);
  box-shadow: var(--shadow-sm);
  z-index: 2;
}

.badgeExpansion { background: var(--pack-expansion); }
.badgeGamePack  { background: var(--pack-game); }
.badgeStuffPack { background: var(--pack-stuff); }
.badgeKit       { background: var(--pack-kit); }

/* ── Footer ── */
.footer {
  padding: 0.2rem 0.375rem 0.3rem;
  background: var(--pack-card-footer);
}

.name {
  font-size: 0.56rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.12s ease;
}

.nameDimmed {
  color: var(--text-subtle);
}

/* ── Meta row ── */
.meta {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-top: 0.75rem;
  margin-bottom: 1.5rem;
}

.count {
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 500;
}

.savedTag {
  font-size: 0.68rem;
  color: var(--text-subtle);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.savedTagVisible {
  opacity: 1;
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
```

Open http://localhost:3000/app/settings/packs and http://localhost:3000/app/onboarding/packs. Toggle between light and dark. Verify:
- Pack card borders use the warm tan in light, subtle white in dark
- Badge colours render (green expansion, amber game pack, lavender stuff, rose kit)
- Card footer is barely visible tint in light, darker in dark
- Dimmed name text uses `--text-subtle`

```bash
git add src/app/components/PackGrid.module.css
git commit -m "feat(theme): update PackGrid with token-based styles and pack-type tokens"
```

---

## Task 10: Brand Direction Document

**Files:**
- Create: `docs/superpowers/specs/2026-05-04-simstrack-brand.md`

- [ ] **Step 1: Write the living brand guide**

Create `docs/superpowers/specs/2026-05-04-simstrack-brand.md`. This is a "what it is" document — not a changelog. Cover:

- **Brand name & tagline:** SimsTrack — "Your Sims universe, tracked" / "Chronicle your Sims legacies"
- **Audience:** Players running Legacy Challenges who want to record every generation, Sim, relationship, and milestone
- **Personality:** Warm, literary, refined — like a beautifully kept journal. Not clinical or game-y. The Sims has a charming, personal quality; the design should too
- **Visual identity:** Parchment & Forest. Warm cream backgrounds, deep forest green as the primary accent (plumbob green), honey amber as a secondary accent reserved for legacy and heir callouts. Cormorant Garamond for display headings; Plus Jakarta Sans for UI text
- **The plumbob:** The iconic green diamond is the brand symbol. It anchors the identity and appears in the nav, landing hero, and sign-in page. Its green facets adapt to light/dark mode via CSS variables
- **Light mode (Parchment):** Default. Warm cream base, deep forest green interactive elements, honey amber for heir/legacy callouts. Accessible contrast throughout
- **Dark mode (Forest Night):** Green backgrounds, not black. Text uses warm neutral grays — green is reserved for interactive elements only, preventing the green-on-green readability problem
- **Accessibility:** All text/background pairs target WCAG AA minimum. `--text-subtle` is used only for uppercase metadata labels, never body copy

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-04-simstrack-brand.md
git commit -m "docs: add SimsTrack brand direction and design system guide"
```

---

## Final Verification

- [ ] Run a full build to confirm no TypeScript or Next.js errors:

```bash
npm run build
```

Expected: successful build with no errors.

- [ ] Sign out, hard-reload http://localhost:3000, toggle dark mode, sign in, navigate all routes. Confirm:
  - No hardcoded `rgba(237, 250, 240, …)` values remain (they belonged to the old dark green theme)
  - No layout shifts or flash on load
  - All badge types render correctly in both modes
  - Focus rings are visible in both modes (tab through the sign-in form)
