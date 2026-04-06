# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Tailwind CSS v4, shadcn/ui components, Wouter routing

## Artifacts

- **web-app** (`artifacts/web-app`) — React + Vite frontend at `/`. Has routing (Home, About), nav bar, and is wired to the API server via the generated `useHealthCheck` hook.
- **api-server** (`artifacts/api-server`) — Express 5 API server at `/api`. Currently exposes `GET /api/healthz`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/web-app run dev` — run frontend locally

## Extending the skeleton

1. **Add API routes**: Create a new file in `artifacts/api-server/src/routes/`, register it in `src/routes/index.ts`, add the endpoint to `lib/api-spec/openapi.yaml`, then run codegen.
2. **Add frontend pages**: Create a new file in `artifacts/web-app/src/pages/`, add the route in `App.tsx`.
3. **Add database tables**: Edit `lib/db/src/schema/index.ts`, then run `pnpm --filter @workspace/db run push`.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
