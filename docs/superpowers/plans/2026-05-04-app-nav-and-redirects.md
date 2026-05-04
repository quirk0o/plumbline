# App Nav & Redirects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent top-bar nav to all authenticated pages under a new `/app` route prefix, with a minimal dashboard and correct login redirects.

**Architecture:** All authenticated pages live under `src/app/app/` which has its own `layout.tsx` that enforces auth and renders the nav. The nav is a client component (needs `usePathname` for active state) that receives user data as props from the server layout. Existing pack pages are moved into this directory; their individual auth redirects are removed since the layout now handles that.

**Tech Stack:** Next.js 16 App Router, NextAuth v5, CSS Modules, TypeScript, Prisma

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `src/app/app/layout.tsx` | Auth guard + nav wrapper for all `/app/*` pages |
| Create | `src/app/app/components/AppNav.tsx` | Client nav component (usePathname for active state) |
| Create | `src/app/app/components/AppNav.module.css` | Nav styles |
| Create | `src/app/app/page.tsx` | Dashboard (`/app`) |
| Create | `src/app/app/page.module.css` | Dashboard styles |
| Create | `src/app/app/onboarding/packs/page.tsx` | Moved from `/onboarding/packs` |
| Create | `src/app/app/onboarding/packs/page.module.css` | Moved styles |
| Create | `src/app/app/settings/packs/page.tsx` | Moved from `/settings/packs` |
| Create | `src/app/app/settings/packs/page.module.css` | Moved styles |
| Delete | `src/app/onboarding/` | Old location |
| Delete | `src/app/settings/` | Old location |
| Modify | `auth.config.ts` | `newUser` → `/app/onboarding/packs` |
| Modify | `src/app/auth/signin/SignInForm.tsx` | Default `callbackUrl` → `/app` |

---

### Task 1: AppNav component

**Files:**
- Create: `src/app/app/components/AppNav.tsx`
- Create: `src/app/app/components/AppNav.module.css`

- [ ] **Step 1: Create the component directory**

```bash
mkdir -p src/app/app/components
```

- [ ] **Step 2: Create `AppNav.module.css`**

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
  font-weight: 700;
  font-size: 0.875rem;
  color: var(--text);
  text-decoration: none;
  flex-shrink: 0;
}

.links {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  flex: 1;
}

.link {
  padding: 0.3rem 0.625rem;
  border-radius: 5px;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(237, 250, 240, 0.45);
  text-decoration: none;
  transition: color 0.12s, background 0.12s;
}

.link:hover {
  color: rgba(237, 250, 240, 0.75);
  background: rgba(255, 255, 255, 0.04);
}

.linkActive {
  color: var(--green) !important;
}

.user {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-left: auto;
  flex-shrink: 0;
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid rgba(52, 211, 153, 0.2);
}

.avatarInitial {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(52, 211, 153, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--green);
}

.signOut {
  font-size: 0.68rem;
  color: rgba(237, 250, 240, 0.25);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  transition: color 0.12s;
  padding: 0;
}

.signOut:hover {
  color: rgba(237, 250, 240, 0.5);
}
```

- [ ] **Step 3: Create `AppNav.tsx`**

```tsx
// src/app/app/components/AppNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import styles from './AppNav.module.css'

interface AppNavProps {
  name: string | null
  email: string | null
  image: string | null
}

function MiniPlumbob() {
  return (
    <svg width="14" height="15" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polygon points="50,5 5,57 50,66" fill="#8fffc4" />
      <polygon points="50,5 95,57 50,66" fill="#34d399" />
      <polygon points="50,105 5,57 50,66" fill="#166f4a" />
      <polygon points="50,105 95,57 50,66" fill="#0a4530" />
    </svg>
  )
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

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/components/
git commit -m "feat(nav): add AppNav top-bar component"
```

---

### Task 2: App layout (auth guard + nav)

**Files:**
- Create: `src/app/app/layout.tsx`

- [ ] **Step 1: Create `src/app/app/layout.tsx`**

```tsx
// src/app/app/layout.tsx
import { redirect } from 'next/navigation'
import { auth } from '../../../auth'
import { AppNav } from './components/AppNav'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/signin?callbackUrl=/app')

  return (
    <>
      <AppNav
        name={session.user.name ?? null}
        email={session.user.email ?? null}
        image={session.user.image ?? null}
      />
      <main>{children}</main>
    </>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/app/layout.tsx
git commit -m "feat(nav): add /app layout with auth guard"
```

---

### Task 3: Dashboard page

**Files:**
- Create: `src/app/app/page.tsx`
- Create: `src/app/app/page.module.css`

- [ ] **Step 1: Create `page.module.css`**

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
  border-radius: 8px;
  text-decoration: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.card:hover {
  border-color: var(--border-bright);
  box-shadow: 0 4px 16px rgba(52, 211, 153, 0.06);
}

.cardLabel {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(237, 250, 240, 0.35);
}

.cardValue {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text);
}

.cardAction {
  font-size: 0.75rem;
  color: var(--green);
  margin-top: 0.25rem;
}

.placeholder {
  font-size: 0.875rem;
  color: rgba(237, 250, 240, 0.2);
}
```

- [ ] **Step 2: Create `src/app/app/page.tsx`**

```tsx
// src/app/app/page.tsx
import Link from 'next/link'
import { auth } from '../../../auth'
import { db } from '@/server/db'
import { PackType } from '@prisma/client'
import styles from './page.module.css'

export default async function DashboardPage() {
  const session = await auth()
  const userId = session!.user.id

  const ownedCount = await db.userPack.count({
    where: { userId, pack: { type: { not: PackType.BASE_GAME } } },
  })

  const firstName = session!.user.name?.split(' ')[0] ?? null
  const greeting = firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'

  return (
    <div className={styles.page}>
      <h1 className={styles.greeting}>{greeting}</h1>

      <div className={styles.cards}>
        <Link href="/app/settings/packs" className={styles.card}>
          <div className={styles.cardLabel}>Your Packs</div>
          <div className={styles.cardValue}>{ownedCount} selected</div>
          <div className={styles.cardAction}>Manage →</div>
        </Link>
      </div>

      <p className={styles.placeholder}>Your legacies will appear here.</p>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/page.tsx src/app/app/page.module.css
git commit -m "feat(nav): add /app dashboard page"
```

---

### Task 4: Move onboarding/packs

**Files:**
- Create: `src/app/app/onboarding/packs/page.tsx`
- Create: `src/app/app/onboarding/packs/page.module.css`
- Delete: `src/app/onboarding/` (entire directory)

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/app/app/onboarding/packs
```

- [ ] **Step 2: Copy and update `page.module.css`**

The CSS is identical to the old file — copy it:

```bash
cp src/app/onboarding/packs/page.module.css src/app/app/onboarding/packs/page.module.css
```

- [ ] **Step 3: Create `src/app/app/onboarding/packs/page.tsx`**

Changes from old version: remove `redirect('/auth/signin')` guard (layout handles it); update `auth` import path; update "Continue" and "Skip" hrefs from `/` to `/app`.

```tsx
// src/app/app/onboarding/packs/page.tsx
import Link from 'next/link'
import { auth } from '../../../../../auth'
import { db } from '@/server/db'
import { PackType } from '@prisma/client'
import { PackGrid } from '@/app/components/PackGrid'
import styles from './page.module.css'

const PACK_TYPE_ORDER: PackType[] = [
  PackType.EXPANSION,
  PackType.GAME_PACK,
  PackType.STUFF_PACK,
  PackType.KIT,
]

export default async function OnboardingPacksPage() {
  const session = await auth()
  const userId = session!.user.id

  const packs = await db.pack.findMany({
    where: { type: { not: PackType.BASE_GAME } },
    include: { userPacks: { where: { userId } } },
    orderBy: { name: 'asc' },
  })

  const grouped = PACK_TYPE_ORDER.map(type => ({
    type,
    packs: packs
      .filter(p => p.type === type)
      .map(({ userPacks, createdAt: _ca, updatedAt: _ua, ...p }) => ({
        ...p,
        isOwned: userPacks.length > 0,
      })),
  })).filter(g => g.packs.length > 0)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.stepLabel}>Onboarding · Step 1</p>
        <h1 className={styles.title}>Which packs do you own?</h1>
        <p className={styles.subtitle}>
          Tap a pack to add it. We&apos;ll only show content from your collection.
        </p>
      </header>

      <PackGrid initialGroups={grouped} />

      <div className={styles.ctaRow}>
        <Link href="/app" className={styles.btnContinue}>
          Continue →
        </Link>
        <Link href="/app" className={styles.btnSkip}>
          Skip for now
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Delete old directory**

```bash
rm -rf src/app/onboarding
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/onboarding/
git rm -r src/app/onboarding/
git commit -m "feat(nav): move onboarding/packs under /app"
```

---

### Task 5: Move settings/packs

**Files:**
- Create: `src/app/app/settings/packs/page.tsx`
- Create: `src/app/app/settings/packs/page.module.css`
- Delete: `src/app/settings/` (entire directory)

- [ ] **Step 1: Create directory**

```bash
mkdir -p src/app/app/settings/packs
```

- [ ] **Step 2: Copy CSS**

```bash
cp src/app/settings/packs/page.module.css src/app/app/settings/packs/page.module.css
```

- [ ] **Step 3: Create `src/app/app/settings/packs/page.tsx`**

Changes from old version: remove `redirect('/auth/signin')` guard; update `auth` import path.

```tsx
// src/app/app/settings/packs/page.tsx
import { auth } from '../../../../../auth'
import { db } from '@/server/db'
import { PackType } from '@prisma/client'
import { PackGrid } from '@/app/components/PackGrid'
import styles from './page.module.css'

const PACK_TYPE_ORDER: PackType[] = [
  PackType.EXPANSION,
  PackType.GAME_PACK,
  PackType.STUFF_PACK,
  PackType.KIT,
]

export default async function SettingsPacksPage() {
  const session = await auth()
  const userId = session!.user.id

  const packs = await db.pack.findMany({
    where: { type: { not: PackType.BASE_GAME } },
    include: { userPacks: { where: { userId } } },
    orderBy: { name: 'asc' },
  })

  const grouped = PACK_TYPE_ORDER.map(type => ({
    type,
    packs: packs
      .filter(p => p.type === type)
      .map(({ userPacks, createdAt: _ca, updatedAt: _ua, ...p }) => ({
        ...p,
        isOwned: userPacks.length > 0,
      })),
  })).filter(g => g.packs.length > 0)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your Packs</h1>
        <p className={styles.subtitle}>Update your collection anytime. Changes save automatically.</p>
      </header>

      <PackGrid initialGroups={grouped} />
    </div>
  )
}
```

- [ ] **Step 4: Delete old directory**

```bash
rm -rf src/app/settings
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/app/settings/
git rm -r src/app/settings/
git commit -m "feat(nav): move settings/packs under /app"
```

---

### Task 6: Update redirect config

**Files:**
- Modify: `auth.config.ts` (line 8 — `newUser` path)
- Modify: `src/app/auth/signin/SignInForm.tsx` (line 21 — default `callbackUrl`)

- [ ] **Step 1: Update `auth.config.ts`**

Change:
```ts
newUser: '/onboarding/packs',
```
To:
```ts
newUser: '/app/onboarding/packs',
```

- [ ] **Step 2: Update default `callbackUrl` in `SignInForm.tsx`**

Change line 21:
```ts
const callbackUrl = searchParams.get('callbackUrl') ?? '/'
```
To:
```ts
const callbackUrl = searchParams.get('callbackUrl') ?? '/app'
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify old routes are gone**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/onboarding/packs
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/settings/packs
```

Expected: both return `404`.

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/app
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/app/settings/packs
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/app/onboarding/packs
```

Expected: all return `307` (redirect to sign-in — auth guard working).

- [ ] **Step 5: Commit**

```bash
git add auth.config.ts src/app/auth/signin/SignInForm.tsx
git commit -m "feat(nav): update login redirects to /app routes"
```

---

## Verification

After all tasks:

1. Sign out if signed in (or use an incognito window)
2. Navigate to `http://localhost:3000/app` → should redirect to `/auth/signin?callbackUrl=/app`
3. Sign in → should land on `/app` (dashboard) with greeting and pack count card
4. Click "Settings" in nav → goes to `/app/settings/packs`, pack grid renders, nav Settings link turns green
5. Click "Dashboard" in nav → goes back to `/app`, Dashboard link turns green
6. Click "Sign out" → returns to `/`
7. Old URLs `http://localhost:3000/onboarding/packs` and `http://localhost:3000/settings/packs` return 404
