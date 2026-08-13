# bSafe — Silent SOS Emergency Web App

bSafe is a web-based silent emergency alert system: a user in danger triggers a silent SOS (single tap / long-press, zero sound or visible confirmation on-device), which shares their live location with pre-configured trusted contacts and tracks the alert until resolved.

> Companion docs: `AGENTS.md` (build plan / working agreement), `docs/PRD.md` (product requirements), `docs/er-diagram.png` (data model).

## Stack

| Layer    | Tech                                                             |
| -------- | ---------------------------------------------------------------- |
| Frontend | React 19 + Vite 7 + TypeScript, Tailwind CSS v4, TanStack Query  |
| Backend  | NestJS 11, Prisma 7 (PostgreSQL), ioredis (Redis)                |
| Auth     | Firebase (auth only)                                             |
| Realtime | Socket.IO via NestJS Gateway                                     |
| Monorepo | npm workspaces (`apps/web`, `apps/api`, `packages/shared-types`) |

## Prerequisites

- Node.js ≥ 20.19, npm 11
- Redis running on `localhost:6379` (project decision)
- PostgreSQL via Docker:

```bash
docker compose up -d postgres   # host port 5434 (5432/5433 commonly taken)
```

## Setup & dev

```bash
npm install
# npm 11 blocks lifecycle scripts — approve once, or Prisma engines/esbuild break:
npm install-scripts approve esbuild prisma @prisma/engines @firebase/util protobufjs
npm run prisma:generate           # regenerate Prisma client

npm run dev                       # API :3000, web :5173
```

Firebase env vars are optional locally — the app runs without them (auth ships in Phase 2). Copy `.env.example` → `.env` for each app (`apps/web`, `apps/api`). Never commit `.env`.

## Scripts

| Command                                | What it does                         |
| -------------------------------------- | ------------------------------------ |
| `npm run dev`                          | API (:3000) + web (:5173) with watch |
| `npm run build`                        | Build API + web                      |
| `npm run lint`                         | ESLint both workspaces               |
| `npm run typecheck`                    | `tsc --noEmit` both workspaces       |
| `npm run prisma:migrate -w @bsafe/api` | Run database migrations (Phase 1)    |
| `npm run prisma:studio -w @bsafe/api`  | Prisma Studio                        |

## Routes

- `GET /api` — hello
- `GET /api/health` — status + Redis PONG
- `Socket.IO` — realtime baseline on the API's `/socket.io` (dev: proxied by Vite `ws: true`, so the web client is same-origin)

## Status

Phase 0 complete (build + lint + dev verified; commit pending). Roadmap in `AGENTS.md`.
