# SimsTrack

A personal web application for tracking a Sims game playthrough. Supports randomizing Sim traits, storing family trees, and tracking challenges.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router) |
| Language | TypeScript |
| API | tRPC (mounted at `/api/trpc/[trpc]`) |
| Client data fetching | TanStack Query (via tRPC) |
| ORM | Prisma |
| Database | PostgreSQL |
| Reference data management | Prisma Studio |

## Architecture

React components call tRPC procedures via a typed client. tRPC procedures live in `src/server/routers/` and use the Prisma client to query PostgreSQL. Game reference data (traits, aspirations, challenge definitions) will live in the database, seeded from `prisma/seed.ts` and editable via Prisma Studio.

## Project Structure

```
simstrack-526/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/trpc/[trpc]/
│   │       └── route.ts              # tRPC HTTP handler
│   ├── server/
│   │   ├── db.ts                     # Prisma client singleton
│   │   ├── trpc.ts                   # tRPC init + context
│   │   └── routers/
│   │       └── index.ts              # Root router (empty, ready to extend)
│   └── trpc/
│       ├── client.ts                 # tRPC React client
│       └── Provider.tsx              # tRPC + TanStack Query provider
├── prisma/
│   ├── schema.prisma                 # Datasource + generator only, no models yet
│   └── seed.ts                       # Empty seed file, ready for reference data
├── .env.local
├── package.json
└── tsconfig.json
```

## Dev Scripts

```bash
npm run dev          # Next.js dev server at localhost:3000
npm run build        # Production build
npm run db:studio    # Prisma Studio at localhost:5555 (reference data management)
npm run db:migrate   # Run migrations
npm run db:seed      # Seed reference data
npm run db:generate  # Regenerate Prisma client
```

## Environment Variables

```
DATABASE_URL=postgresql://user:password@localhost:5432/simstrack
```

## Content Management

Game reference data (traits, aspirations, challenge rules, etc.) is managed via:
1. **Prisma Studio** (`npm run db:studio`) — browser-based GUI for direct database editing
2. **`prisma/seed.ts`** — TypeScript seed file for version-controlled initial data
