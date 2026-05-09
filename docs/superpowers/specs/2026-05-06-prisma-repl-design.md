# Prisma REPL

## Context

Developers need a quick way to query and inspect the database during development without spinning up Prisma Studio or writing a one-off script. A REPL with the Prisma client pre-loaded lets you run ad-hoc queries interactively.

## Design

A single `scripts/repl.mjs` file that starts a Node.js REPL with the Prisma client available as `db`.

### What it does

- Creates a `PrismaClient` instance using `DATABASE_URL` from `.env`
- Starts a Node.js REPL with prompt `simtrack> `
- Injects `db` into the REPL context
- Prints a short welcome banner listing available globals
- Disconnects Prisma cleanly on exit (`.exit` or Ctrl+D)

### Tab completion

Node's REPL autocompletes on runtime object properties. Typing `db.` + Tab shows all Prisma model accessors (`user`, `household`, `legacy`, etc.). Typing `db.user.` + Tab shows all query methods (`findMany`, `findFirst`, `create`, `update`, `delete`, etc.).

Top-level `await` works natively — `await db.user.findMany({ take: 5 })` just works.

## Files

| File | Change |
|------|--------|
| `scripts/repl.mjs` | New — REPL bootstrap script |
| `package.json` | Add `"repl"` script |

## npm script

```json
"repl": "node --env-file=.env scripts/repl.mjs"
```

## Verification

1. Run `npm run repl`
2. Banner prints, prompt shows `simtrack> `
3. Type `db.` + Tab — model names appear
4. Type `await db.user.findMany({ take: 1 })` — returns results
5. Type `.exit` — Prisma disconnects cleanly, process exits
