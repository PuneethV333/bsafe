# PHASE_LOG.md

Tracks progress through the phases defined in AGENTS.md.

## Phase 0 — Repo & Environment Setup

**Status:** IMPLEMENTED & VERIFIED — commit pending.

### What was built

- npm workspaces monorepo: root `package.json`, `tsconfig.base.json`, Prettier, `docker-compose.yml`.
- `apps/web`: Vite 7 + React 19 + TypeScript, Tailwind CSS v4, TanStack Query, react-router-dom, axios, `firebase` (auth-only, no-op without env).
- `apps/api`: NestJS 11, Prisma 7 (schema/models defined — **no migrations yet**, that is Phase 1), ioredis on localhost, `ConfigModule`, global `ValidationPipe`, global `/api` prefix.
- `packages/shared-types`: UserDto / EmergencyContactDto / AlertDto.
- Routes: `GET /api`, `GET /api/health`.

### What was tested

- `npm install` clean; lifecycle scripts approved (`npm install-scripts approve ...`).
- `npm run build`, `npm run lint`, `npm run typecheck` pass for both workspaces.
- `docker compose up -d postgres` → container **healthy**, host port **5434**; `SELECT 1` + `SELECT current_database()` work via psql.
- Prisma driver-adapter connectivity verified against the container (raw `$queryRaw` → `bsafe` database).
- `npm run dev` verified: API :3000 + web :5173 up; Vite proxy `/api` → API works; `/api/health` returns `{"status":"ok","redis":"PONG"}`.

### Known gaps / TODOs for next phase

- Prisma migrations not yet run — Phase 1.
- No Firebase credentials yet (`.env.example` placeholders) — Phase 2.
- No CI.
- Phase 0 commit not made (awaiting user).

---

## Realtime baseline (Phase 0 addendum)

User directive: "use websockets … as baseline for everything that realtime".

**Status:** IMPLEMENTED & VERIFIED — uncommitted.

### What was built

- `apps/api/src/realtime/realtime.gateway.ts`: Socket.IO gateway (default `/socket.io`, same :3000 HTTP server); emits `realtime:hello` on connect; CORS allows localhost:5173.
- `apps/web/src/lib/realtime.ts` + `apps/web/src/lib/RealtimeContext.tsx`: same-origin client via Vite ws proxy; `RealtimeProvider` + `useRealtime()` (status / clientId / lastEvent).
- `apps/web/src/components/Sidebar.tsx`: app-shell sidebar (trigger / contacts / alerts / settings) with live connection dot + last event readout.
- Vite proxy `/socket.io` (ws: true) → `localhost:3000`.

### What was tested

- Socket.IO client connected through the Vite ws proxy (`http://localhost:5173`, websocket transport) and received `realtime:hello` (`{"clientId":"…","serverTime":"…"}`).
- `npm run lint` / `typecheck` / `build` / Prettier all pass.

### Decisions / TODOs

- All realtime features (Phase 5 location streaming, Phase 7 tracking status) must go through `RealtimeGateway` — no REST polling for realtime data.
- Phase 2: gateway must verify the Firebase ID token from `client.handshake.auth.token`; until then sockets are unauthenticated (dev only).
- Phase 5: join sockets to per-alert rooms (`alert:<id>`) for scoped emits.
- Phase 10: tighten gateway CORS origin whitelist + reverse-proxy ws in production.
