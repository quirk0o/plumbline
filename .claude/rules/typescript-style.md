---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# TypeScript Style

Formatting and mechanical rules belong to Prettier and ESLint — run
`npm run lint` and don't hand-fight them. This guide is about the thing tools
can't check: making code easy for the next person to read.

## Name things well

- Name for the concept, not the implementation: `parents`, not `parentArray`;
  `activeSims`, not `filtered`.
- Boolean names read as a yes/no question: `isHeir`, `hasParent`, `canEdit`.
- A longer, clear name beats a short, cryptic one. Don't abbreviate to save
  keystrokes.
- If you need a comment to explain what a variable holds, the name is wrong —
  rename it instead.

## Keep functions readable

- One function, one job. If you're tempted to break it up with numbered
  comments (`// 1. validate`, `// 2. fetch`), extract those steps into named
  helpers instead — the helper names become the comments.
- Return early. Handle the error or empty case up front and let the happy path
  flow down the left margin, rather than nesting it inside an `if`.
- Keep nesting shallow. Three levels of indentation is a smell; pull the inner
  block into its own function.

## Prefer the obvious over the clever

- Write code to be read, not to show off. A plain `for`/`map` that's instantly
  clear beats a dense one-liner that needs decoding.
- Name intermediate values instead of chaining six operations on one line —
  the variable name tells the reader what each step produces.
- Avoid magic numbers and bare strings. Give them a named constant that says
  what they mean.

## Comments explain *why*

- Good code shows *what* it does; comments are for *why* — the constraint, the
  edge case, the reason this isn't the obvious approach.
- Delete commented-out code. Version control remembers it for you.
- Avoid comments that restate the code. If you need a comment to explain what
  the code does, the code needs to be rewritten to make it clearer.

## Let types document the code

- Model invalid states out of existence with discriminated unions, so the
  reader sees the real shapes the data can take and the compiler flags a
  missing case.
- Reach for `??` and `?.` rather than truthiness checks that mishandle
  `0`/`''` — they say "default when absent" more precisely.

## Avoid god files

- Avoid large files (>300 lines) with many exports. This avoids conflicts when multiple agents
  edit the same domain and makes it easier to find where a concept lives. 
  Group files by domain and keep them small and focused.
