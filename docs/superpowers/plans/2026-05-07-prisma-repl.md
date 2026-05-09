# Prisma REPL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive Node.js REPL with the Prisma client pre-loaded so developers can run ad-hoc database queries during development.

**Architecture:** A single `scripts/repl.mjs` ES module creates a `PrismaClient` (with the `PrismaPg` adapter, matching the app's connection setup) and starts a Node.js REPL with `db` injected into the context. An `npm run repl` script loads `.env` and launches it.

**Tech Stack:** Node.js built-in `repl` module, `@prisma/client`, `@prisma/adapter-pg`

---

### Task 1: Create the REPL script

> Note: This is a developer tool with no business logic — manual smoke-testing replaces unit tests here.

**Files:**
- Create: `scripts/repl.mjs`

- [ ] **Step 1: Create `scripts/repl.mjs`**

```javascript
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import repl from 'node:repl'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not set')

const adapter = new PrismaPg({ connectionString })
const db = new PrismaClient({ adapter })

console.log('simtrack REPL')
console.log('Globals: db (Prisma client)')
console.log('Tip: await db.<model>.<method>(...) | .exit to quit\n')

const r = repl.start({ prompt: 'simtrack> ', useGlobal: false })
r.context.db = db

r.on('exit', async () => {
  await db.$disconnect()
  process.exit(0)
})
```

### Task 2: Wire up the npm script and commit

**Files:**
- Modify: `package.json` (scripts section)

- [ ] **Step 1: Add the `repl` script to `package.json`**

In the `"scripts"` block, after `"db:generate"`, add:

```json
"repl": "node --env-file=.env scripts/repl.mjs",
```

- [ ] **Step 2: Commit**

```bash
git add scripts/repl.mjs package.json
git commit -m "feat: add interactive Prisma REPL"
```

### Task 3: Smoke-test

- [ ] **Step 1: Start the REPL**

```bash
npm run repl
```

Expected output:
```
simtrack REPL
Globals: db (Prisma client)
Tip: await db.<model>.<method>(...) | .exit to quit

simtrack>
```

- [ ] **Step 2: Verify tab completion**

At the prompt, type `db.` then press Tab.

Expected: A list of Prisma model names appears (e.g. `user`, `household`, `legacy`, `skill`, `career`, `trait`, `aspiration`).

- [ ] **Step 3: Run a query**

```javascript
await db.user.findMany({ take: 1 })
```

Expected: Returns an array (empty or with rows — either is fine as long as it doesn't throw).

- [ ] **Step 4: Verify clean exit**

Type `.exit` and press Enter.

Expected: Process exits without hanging. No `Error: Connection terminated` messages.
