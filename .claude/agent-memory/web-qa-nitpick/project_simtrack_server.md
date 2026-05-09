---
name: SimTrack dev server port
description: The worktree dev server runs on port 3001, not 3000; magic links are logged to .next/dev/logs/next-development.log
type: project
---

The Next.js dev server for the `feat+legacy-creation-wizard` worktree runs on **port 3001**, not 3000. Port 3000 is occupied by a different process (PID varies).

**Why:** Multiple worktrees/servers are running simultaneously; the worktree server picks 3001.

**How to apply:** Always navigate Playwright to `http://localhost:3001` when testing this worktree. Magic links are written to `.next/dev/logs/next-development.log` and reference port 3001. Rewrite them to 3001 (they already are 3001 in this worktree). Dashboard URL is `/app`, not `/app/dashboard`.
