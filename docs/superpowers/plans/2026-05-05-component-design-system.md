# Component Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a shared `src/components/ui/` component library (Button, Input, Badge, Card, FormField) that extracts duplicated styles from page-level CSS Modules into reusable primitives, then refactor existing components to use them.

**Architecture:** CSS Modules + CSS Variables throughout — no Tailwind, no CVA, no shadcn. Each component gets a `.tsx` + `.module.css` file pair. Variants are implemented as separate CSS module classes composed with a `cn()` utility. No new dependencies are added.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, CSS custom properties

---

## File Map

**New files:**
- `src/lib/utils.ts` — `cn()` class-name helper
- `src/components/ui/button/button.tsx` + `.module.css`
- `src/components/ui/input/input.tsx` + `.module.css`
- `src/components/ui/badge/badge.tsx` + `.module.css`
- `src/components/ui/card/card.tsx` + `.module.css`
- `src/components/ui/form-field/form-field.tsx` + `.module.css`
- `src/components/ui/index.ts` — barrel export
- `src/components/theme-provider.module.css` — replaces ThemeToggle's inline styles

**Modified files:**
- `src/components/theme-provider.tsx` — replace inline `style={{}}` with CSS module class
- `src/app/auth/signin/sign-in-form.tsx` — use `Button` + `Input`
- `src/app/auth/signin/signin.module.css` — remove migrated styles (`.googleButton`, `.submitButton`, `.input`)
- `src/app/app/components/app-nav.tsx` — use `Button` for sign-out
- `src/app/app/components/app-nav.module.css` — remove `.signOut`
- `src/app/app/onboarding/packs/page.tsx` — use `ButtonLink` for CTA links
- `src/app/app/onboarding/packs/page.module.css` — remove `.btnContinue`, `.btnSkip`

**Not touched:**
- `src/app/globals.css` — all tokens stay as-is
- `src/app/components/pack-grid.tsx` / `.module.css` — card toggle UI is too specific

> **No test runner exists** in this project. Verification for each task uses `npx tsc --noEmit` (type correctness) and visual browser checks (rendering). Navigate to `http://localhost:3000` with `npm run dev` running.

---

## Task 1: cn() utility

**Files:**
- Create: `src/lib/utils.ts`

- [ ] **Step 1: Create the utility**

```ts
// src/lib/utils.ts
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.ts
git commit -m "feat(ui): add cn() class-name utility"
```

---

## Task 2: Button component

**Files:**
- Create: `src/components/ui/button/button.tsx`
- Create: `src/components/ui/button/button.module.css`

- [ ] **Step 1: Create the CSS module**

CSS classes are extracted directly from `signin.module.css` (`.googleButton`, `.submitButton`) and `app-nav.module.css` (`.signOut`) and `onboarding/packs/page.module.css` (`.btnContinue`, `.btnSkip`).

```css
/* src/components/ui/button/button.module.css */

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-base);
  font-family: var(--font-body);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  white-space: nowrap;
  outline: none;
  text-decoration: none;
  transition:
    background var(--transition-base),
    border-color var(--transition-base),
    color var(--transition-base),
    transform var(--transition-base),
    box-shadow var(--transition-base);
}

.button:focus-visible {
  box-shadow: var(--focus-ring);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* ── Variants ── */

.primary {
  background: var(--green);
  color: var(--bg);
  font-size: 0.9rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.primary:hover {
  background: var(--green-bright);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.outline {
  background: var(--bg-surface);
  color: var(--text);
  border-color: var(--border);
  letter-spacing: 0.01em;
  font-size: 0.9rem;
  font-weight: var(--weight-medium);
}

.outline:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-bright);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.ghost {
  background: none;
  color: var(--text-subtle);
  border-color: transparent;
}

.ghost:hover {
  color: var(--text-muted);
  background: var(--bg-card-hover);
}

.link {
  background: none;
  color: var(--text-subtle);
  border-color: transparent;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.link:hover {
  color: var(--text-muted);
}

.destructive {
  background: var(--error);
  color: #fff;
}

.destructive:hover {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* ── Sizes ── */

.sm {
  padding: 0.3rem 0.625rem;
  font-size: var(--text-sm);
}

.base {
  padding: 0.8125rem 1.25rem;
}

.lg {
  padding: 0.875rem 1.875rem;
  font-size: var(--text-base);
}

.icon {
  padding: var(--space-1);
  width: 2rem;
  height: 2rem;
}

/* ── Modifiers ── */

.fullWidth {
  width: 100%;
}
```

- [ ] **Step 2: Create the component**

```tsx
// src/components/ui/button/button.tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import styles from './button.module.css'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'link' | 'destructive'
  size?: 'sm' | 'base' | 'lg' | 'icon'
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'base',
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export interface ButtonLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'link'
  size?: 'sm' | 'base' | 'lg'
  fullWidth?: boolean
  href: string
}

export function ButtonLink({
  variant = 'primary',
  size = 'base',
  fullWidth = false,
  href,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        styles.button,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/button/
git commit -m "feat(ui): add Button and ButtonLink components"
```

---

## Task 3: Input component

**Files:**
- Create: `src/components/ui/input/input.tsx`
- Create: `src/components/ui/input/input.module.css`

- [ ] **Step 1: Create the CSS module**

Extracted verbatim from `src/app/auth/signin/signin.module.css` lines 134–154, with `:focus` upgraded to `:focus-visible`.

```css
/* src/components/ui/input/input.module.css */

.input {
  width: 100%;
  padding: 0.8125rem 1rem;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-base);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 0.9rem;
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
  outline: none;
}

.input::placeholder {
  color: var(--text-subtle);
}

.input:focus-visible {
  border-color: var(--green);
  box-shadow: var(--focus-ring);
}

.error {
  border-color: var(--error);
}

.error:focus-visible {
  border-color: var(--error);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--error) 30%, transparent);
}
```

- [ ] **Step 2: Create the component**

```tsx
// src/components/ui/input/input.tsx
import { cn } from '@/lib/utils'
import styles from './input.module.css'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error = false, className, ...props }: InputProps) {
  return (
    <input
      className={cn(styles.input, error && styles.error, className)}
      {...props}
    />
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/input/
git commit -m "feat(ui): add Input component"
```

---

## Task 4: Badge component

**Files:**
- Create: `src/components/ui/badge/badge.tsx`
- Create: `src/components/ui/badge/badge.module.css`

- [ ] **Step 1: Create the CSS module**

Pack type colors (`--pack-expansion` etc.) are already defined in `globals.css`. Status variants use `color-mix()` — the same pattern used for `.error` in `signin.module.css` line 211.

```css
/* src/components/ui/badge/badge.module.css */

.badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  font-weight: var(--weight-bold);
  padding: 0.15rem 0.45rem;
  border-radius: var(--radius-xs);
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0.02em;
  border: 1px solid transparent;
}

/* Pack type variants — use existing pack tokens from globals.css */

.expansion {
  background: var(--pack-expansion);
  color: var(--pack-badge-text);
}

.game {
  background: var(--pack-game);
  color: var(--pack-badge-text);
}

.stuff {
  background: var(--pack-stuff);
  color: var(--pack-badge-text);
}

.kit {
  background: var(--pack-kit);
  color: var(--pack-badge-text);
}

/* Status variants */

.success {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  color: var(--success);
  border-color: color-mix(in srgb, var(--success) 25%, transparent);
}

.error {
  background: color-mix(in srgb, var(--error) 8%, transparent);
  color: var(--error);
  border-color: color-mix(in srgb, var(--error) 18%, transparent);
}

.warning {
  background: color-mix(in srgb, var(--warning) 12%, transparent);
  color: var(--warning);
  border-color: color-mix(in srgb, var(--warning) 22%, transparent);
}

.info {
  background: color-mix(in srgb, var(--info) 12%, transparent);
  color: var(--info);
  border-color: color-mix(in srgb, var(--info) 22%, transparent);
}

.neutral {
  background: var(--bg-card-hover);
  color: var(--text-muted);
  border-color: var(--border);
}
```

- [ ] **Step 2: Create the component**

```tsx
// src/components/ui/badge/badge.tsx
import { cn } from '@/lib/utils'
import styles from './badge.module.css'

export type BadgeVariant =
  | 'expansion'
  | 'game'
  | 'stuff'
  | 'kit'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'neutral'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(styles.badge, styles[variant], className)}
      {...props}
    />
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/badge/
git commit -m "feat(ui): add Badge component"
```

---

## Task 5: Card component

**Files:**
- Create: `src/components/ui/card/card.tsx`
- Create: `src/components/ui/card/card.module.css`

- [ ] **Step 1: Create the CSS module**

Base pattern from `signin.module.css` `.card` and `page.module.css` `.featureCard`.

```css
/* src/components/ui/card/card.module.css */

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  position: relative;
}

.hoverable {
  transition:
    border-color var(--transition-slow),
    background var(--transition-slow),
    transform var(--transition-slow),
    box-shadow var(--transition-slow);
}

.hoverable:hover {
  border-color: var(--border-bright);
  background: var(--bg-card-hover);
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.sm {
  padding: var(--space-4) var(--space-5);
}

.base {
  padding: 1.875rem;
}

.lg {
  padding: var(--space-8) var(--space-10);
}
```

- [ ] **Step 2: Create the component**

```tsx
// src/components/ui/card/card.tsx
import { cn } from '@/lib/utils'
import styles from './card.module.css'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'article' | 'section'
  hoverable?: boolean
  padding?: 'sm' | 'base' | 'lg'
}

export function Card({
  as: Tag = 'div',
  hoverable = false,
  padding = 'base',
  className,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        styles.card,
        styles[padding],
        hoverable && styles.hoverable,
        className,
      )}
      {...props}
    />
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/card/
git commit -m "feat(ui): add Card component"
```

---

## Task 6: FormField component

**Files:**
- Create: `src/components/ui/form-field/form-field.tsx`
- Create: `src/components/ui/form-field/form-field.module.css`

- [ ] **Step 1: Create the CSS module**

```css
/* src/components/ui/form-field/form-field.module.css */

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.label {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text-muted);
}

.required {
  color: var(--error);
  margin-left: 0.125rem;
}

.error {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--error);
}

.hint {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-subtle);
}
```

- [ ] **Step 2: Create the component**

```tsx
// src/components/ui/form-field/form-field.tsx
import { cn } from '@/lib/utils'
import styles from './form-field.module.css'

export interface FormFieldProps {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn(styles.field, className)}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/form-field/
git commit -m "feat(ui): add FormField component"
```

---

## Task 7: Barrel export

**Files:**
- Create: `src/components/ui/index.ts`

- [ ] **Step 1: Create the barrel export**

```ts
// src/components/ui/index.ts
export { Button, ButtonLink } from './button/button'
export type { ButtonProps, ButtonLinkProps } from './button/button'
export { Input } from './input/input'
export type { InputProps } from './input/input'
export { Badge } from './badge/badge'
export type { BadgeProps, BadgeVariant } from './badge/badge'
export { Card } from './card/card'
export type { CardProps } from './card/card'
export { FormField } from './form-field/form-field'
export type { FormFieldProps } from './form-field/form-field'
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/index.ts
git commit -m "feat(ui): add barrel export for ui components"
```

---

## Task 8: Refactor ThemeToggle — replace inline styles with CSS module

**Files:**
- Create: `src/components/theme-provider.module.css`
- Modify: `src/components/theme-provider.tsx`

The `ThemeToggle` in `theme-provider.tsx` uses an inline `style={{...}}` object. Replace it with a CSS module class.

- [ ] **Step 1: Create the CSS module**

```css
/* src/components/theme-provider.module.css */

.toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  outline: none;
  transition: color var(--transition-fast);
}

.toggle:focus-visible {
  box-shadow: var(--focus-ring);
}

.toggle:hover {
  color: var(--text);
}
```

- [ ] **Step 2: Update ThemeToggle in theme-provider.tsx**

Open `src/components/theme-provider.tsx`. Add the import at the top alongside existing imports:

```tsx
import styles from './theme-provider.module.css'
```

Find the `ThemeToggle` function and replace the button element. The existing code is:

```tsx
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
```

Replace with:

```tsx
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      className={styles.toggle}
    >
```

(Keep all the SVG children inside the button unchanged.)

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and verify toggle renders correctly**

```bash
npm run dev
```

Navigate to `http://localhost:3000`. The sun/moon icon should appear, be clickable, and focus ring should show on keyboard focus. Dark mode must still work.

- [ ] **Step 5: Commit**

```bash
git add src/components/theme-provider.tsx src/components/theme-provider.module.css
git commit -m "refactor(theme): replace ThemeToggle inline styles with CSS module"
```

---

## Task 9: Refactor SignInForm — use Button and Input

**Files:**
- Modify: `src/app/auth/signin/sign-in-form.tsx`
- Modify: `src/app/auth/signin/signin.module.css`

- [ ] **Step 1: Update sign-in-form.tsx**

Open `src/app/auth/signin/sign-in-form.tsx`. Add import at top (after the existing `Plumbob` import):

```tsx
import { Button, Input } from '@/components/ui'
```

Find the Google OAuth button and replace it:

**Old:**
```tsx
<button className={styles.googleButton} onClick={() => signIn('google', { callbackUrl })} type="button">
  <GoogleIcon />
  Continue with Google
</button>
```

**New:**
```tsx
<Button variant="outline" fullWidth type="button" onClick={() => signIn('google', { callbackUrl })}>
  <GoogleIcon />
  Continue with Google
</Button>
```

Find the email input and replace it:

**Old:**
```tsx
<input type="email" required placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.input} />
```

**New:**
```tsx
<Input
  type="email"
  id="email"
  required
  placeholder="your@email.com"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
```

Find the submit button and replace it:

**Old:**
```tsx
<button type="submit" className={styles.submitButton}>Send magic link</button>
```

**New:**
```tsx
<Button variant="primary" fullWidth type="submit">Send magic link</Button>
```

- [ ] **Step 2: Remove migrated styles from signin.module.css**

Open `src/app/auth/signin/signin.module.css` and delete these blocks entirely (they're now in the ui components):
- `.googleButton` and `.googleButton:hover` (lines ~77–101)
- `.input`, `.input::placeholder`, `.input:focus` (lines ~134–154)
- `.submitButton` and `.submitButton:hover` (lines ~156–176)

**Keep these** (they are layout/composition, not component styles):
- `.page`, `.card`, `@keyframes fadeUp`, `.plumbobWrap`, `.plumbob`, `@keyframes float`, `.header`, `.title`, `.subtitle`, `.form`, `.googleIcon`, `.divider`, `.dividerLine`, `.dividerText`, `.emailForm`, `.success`, `.successIcon`, `.successTitle`, `.successText`, `.error`

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and verify sign-in page**

```bash
npm run dev
```

Navigate to `http://localhost:3000/auth/signin`. Verify:
- Google button: surface background, border, text color, hover lift — matches original appearance
- Email input: same padding, border, focus ring (now `:focus-visible`)
- Submit button: green background, uppercase text, hover lift — matches original appearance
- Dark mode: toggle theme and verify all three elements adapt correctly

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/signin/sign-in-form.tsx src/app/auth/signin/signin.module.css
git commit -m "refactor(signin): use shared Button and Input components"
```

---

## Task 10: Refactor AppNav — use Button for sign-out

**Files:**
- Modify: `src/app/app/components/app-nav.tsx`
- Modify: `src/app/app/components/app-nav.module.css`

- [ ] **Step 1: Update app-nav.tsx**

Open `src/app/app/components/app-nav.tsx`. Add import after the existing imports:

```tsx
import { Button } from '@/components/ui'
```

Find the sign-out button and replace it:

**Old:**
```tsx
<button className={styles.signOut} onClick={() => signOut({ callbackUrl: '/' })}>
  Sign out
</button>
```

**New:**
```tsx
<Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
  Sign out
</Button>
```

- [ ] **Step 2: Remove .signOut from app-nav.module.css**

Open `src/app/app/components/app-nav.module.css` and delete the `.signOut` rule block.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify in browser**

Navigate to `http://localhost:3000/app` (sign in first — see AGENTS.md for the magic link flow). Verify sign-out button renders with muted text, no border, and hover shows background tint.

- [ ] **Step 5: Commit**

```bash
git add src/app/app/components/app-nav.tsx src/app/app/components/app-nav.module.css
git commit -m "refactor(nav): use Button component for sign-out"
```

---

## Task 11: Refactor Onboarding CTAs — use ButtonLink

**Files:**
- Modify: `src/app/app/onboarding/packs/page.tsx`
- Modify: `src/app/app/onboarding/packs/page.module.css`

- [ ] **Step 1: Update page.tsx**

Open `src/app/app/onboarding/packs/page.tsx`. The file currently imports `Link from 'next/link'`. Add the ButtonLink import:

```tsx
import { ButtonLink } from '@/components/ui'
```

Find the CTA row at the bottom and replace the two Link elements:

**Old:**
```tsx
<div className={styles.ctaRow}>
  <Link href="/app" className={styles.btnContinue}>
    Continue →
  </Link>
  <Link href="/app" className={styles.btnSkip}>
    Skip for now
  </Link>
</div>
```

**New:**
```tsx
<div className={styles.ctaRow}>
  <ButtonLink href="/app" variant="primary" size="sm">
    Continue →
  </ButtonLink>
  <ButtonLink href="/app" variant="link" size="sm">
    Skip for now
  </ButtonLink>
</div>
```

Remove the `Link` import if it is no longer used elsewhere in the file. (Check: if `Link` is only used for these two elements, delete `import Link from 'next/link'`.)

- [ ] **Step 2: Remove migrated styles from page.module.css**

Open `src/app/app/onboarding/packs/page.module.css` and delete:
- `.btnContinue` and `.btnContinue:hover`
- `.btnSkip` and `.btnSkip:hover`

Keep `.ctaRow` (it is a layout class: `display: flex; align-items: center; gap: 1.25rem; margin-top: 1.75rem`).

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Verify in browser**

Navigate to `http://localhost:3000/app/onboarding/packs`. Verify:
- "Continue →" renders as green primary button
- "Skip for now" renders as underline-only link style
- Both navigate to `/app` on click

- [ ] **Step 5: Commit**

```bash
git add src/app/app/onboarding/packs/page.tsx src/app/app/onboarding/packs/page.module.css
git commit -m "refactor(onboarding): use ButtonLink for CTA links"
```

---

## Final verification

- [ ] Run TypeScript check across the full project:

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] Toggle dark mode on each of these pages and confirm new components adapt correctly: `/auth/signin`, `/app`, `/app/onboarding/packs`.

- [ ] Confirm no `// eslint-disable`, `// @ts-ignore`, `// @ts-expect-error` were introduced:

```bash
grep -r "eslint-disable\|@ts-ignore\|@ts-expect-error\|@ts-nocheck" src/components/ui src/lib/utils.ts
```

Expected: no output.
