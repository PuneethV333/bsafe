# bSafe — Silent SOS Emergency Web App

bSafe is a web-based silent emergency alert system: a user in danger triggers a silent SOS (single tap / long-press, zero sound or visible confirmation on-device), which shares their live location with pre-configured trusted contacts and tracks the alert until resolved.

> **Important:** bSafe is a **portfolio/demo build, not a production safety product.** It is not connected to any emergency services. Do not rely on it in a real emergency — call your local emergency number instead.

---

## Overview

| What | Where |
| --- | --- |
| **Web app** (React) | `apps/web` — sign in/up, contacts, profile, silent SOS trigger, admin dashboard |
| **API** (NestJS) | `apps/api` — auth, contacts, alerts, tracking, notifications, admin, realtime gateway |
| **Shared types** | `packages/shared-types` — TS DTOs shared by web + API |
| **Production** | Web: Vercel · API: Render · Postgres: Neon · Redis: Upstash |

Companion docs:

- `AGENTS.md` — build plan / working agreement (phase-by-phase history)
- `docs/PRD.md` — product requirements, KPIs, scope
- `docs/er-diagram.png` — data model
- `docs/deployment.md` — production deployment runbook
- `BACKEND_FILES_AND_ROUTES.md` — API file scaffold + per-route rate-limit table

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19 + Vite 7 + TypeScript, Tailwind CSS v4, TanStack Query, React Router, Leaflet |
| Backend | NestJS 11, Prisma 7 (PostgreSQL), ioredis (Redis) |
| Auth | Firebase (auth only — email/password + phone OTP) |
| Realtime | Socket.IO via NestJS Gateway |
| Notifications | Twilio (SMS) + SendGrid (email) dispatched via BullMQ (dry-run by default) |
| Rate limit / cache | `@nestjs/throttler` with Redis storage + custom `CacheService` |
| Monorepo | npm workspaces (`apps/*`, `packages/*`) |

## Architecture

```mermaid
flowchart LR
    subgraph User["User (browser)"]
        Web[apps/web - React SPA]
    end
    subgraph Contact["Contact (browser)"]
        Track["/track/:token public page"]
    end

    Web -->|REST /api + Socket.IO /socket.io| API
    Track -->|REST /api/tracking/:token| API

    subgraph API["apps/api - NestJS"]
        API[Controllers + FirebaseAuthGuard]
        GW[RealtimeGateway]
        Q[BullMQ worker in-process]
    end

    API --> PG[(PostgreSQL / Neon)]
    API --> R[(Redis / Upstash)]
    Q --> R
    Q -->|Twilio SMS + SendGrid email| N[Contacts' SMS / email]
    GW -->|location stream + status| Web
```

Data flow on an SOS trigger:

1. User taps/long-presses the silent trigger on the home screen.
2. `POST /api/alerts/trigger` creates an `Alert` (status `sent`) and enqueues a BullMQ notification job **per contact, per channel**.
3. The device starts a `watchPosition` loop; each fix is persisted to `alert_locations` and pushed to the user's socket room (REST fallback).
4. Contacts receive SMS/email with a tokenized tracking link (`/track/:token`); the link shows a live map, alert status and timestamps.
5. Contacts can acknowledge; the user (or a contact) resolves the alert. Every transition is written to `activity_logs`.

## Prerequisites

- Node.js ≥ 20.19, npm 11
- Redis running on `localhost:6379`
- PostgreSQL via Docker (host port **5434** — 5432/5433 are commonly taken; Postgres 18 needs the data volume at `/var/lib/postgresql`):

```bash
docker compose up -d postgres
```

## Setup & dev

```bash
# 1. Install (npm 11 blocks lifecycle scripts — approve once, or Prisma engines/esbuild break):
npm install
npm install-scripts approve esbuild prisma @prisma/engines @firebase/util protobufjs

# 2. Environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
#   - apps/api/.env: set DATABASE_URL (localhost:5434), REDIS_URL (redis://localhost:6379);
#     Firebase/Twilio/SendGrid are optional locally.
#   - apps/web/.env: set VITE_FIREBASE_* to enable auth; leave VITE_API_URL empty for dev.

# 3. Database
npm run prisma:generate -w @bsafe/api   # regenerate Prisma client (also runs on postinstall)
npm run prisma:migrate -w @bsafe/api    # apply migrations
npm run prisma:seed -w @bsafe/api       # optional sample data

# 4. Run
npm run dev   # API :3000 + web :5173 with watch
```

Then open http://localhost:5173. The Vite dev server proxies `/api` and `/socket.io` (ws) to `:3000`, so the web client is same-origin. `GET /api/health` → `{"status":"ok","redis":"PONG"}`.

> Firebase is **auth-only** and optional locally: the app starts without it and shows a "Firebase not configured" notice on the login page. Without a configured project you can still run the API, health check and realtime baseline.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (:3000) + web (:5173) with watch |
| `npm run build` | Build API + web |
| `npm run lint` | ESLint both workspaces |
| `npm run typecheck` | `tsc --noEmit` both workspaces |
| `npm run format` | Prettier write |
| `npm run prisma:generate -w @bsafe/api` | Regenerate Prisma client |
| `npm run prisma:migrate -w @bsafe/api` | Apply DB migrations |
| `npm run prisma:seed -w @bsafe/api` | Seed sample data |
| `npm run prisma:studio -w @bsafe/api` | Prisma Studio |

## Environment variables

**API** (`apps/api/.env`) — see `.env.example` for the full list with comments:

| Var | Required locally | Notes |
| --- | --- | --- |
| `PORT` | – | default 3000 |
| `DATABASE_URL` | ✅ | Postgres; local `postgresql://bsafe:bsafe@localhost:5434/bsafe?schema=public` |
| `REDIS_URL` | ✅ | `redis://localhost:6379` locally; Upstash `rediss://…` in prod. **No fallback** — a missing value fails loudly |
| `CORS_ORIGINS` | – | comma-separated allowed origins (`http://localhost:5173` locally) |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | – | Firebase Admin SDK for ID-token verification |
| `ADMIN_EMAILS` | – | comma-separated emails granted `isAdmin` |
| `TWILIO_*`, `SENDGRID_*`, `WEB_BASE_URL`, `NOTIFICATIONS_DRY_RUN` | – | notification providers; dry-run logs instead of sending |

**Web** (`apps/web/.env`):

| Var | Required locally | Notes |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` / `AUTH_DOMAIN` / `PROJECT_ID` / `APP_ID` | – | enable auth; app runs without them |
| `VITE_API_URL` | – | leave empty in dev (Vite proxy); set to deployed API in production |

Never commit `.env` files — `.gitignore` excludes them.

## API routes

All routes are behind the global `/api` prefix and individually rate-limited (Redis-backed).

| Method | Route | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/health` | – | status + Redis PONG |
| POST | `/auth/sync` | Firebase | upsert local user from Firebase identity |
| GET | `/auth/me` | ✅ | current user |
| GET/PATCH | `/users/me` | ✅ | profile read / update |
| GET/POST | `/contacts` | ✅ | list / create (max 5, dedup) |
| PATCH/DELETE | `/contacts/:id` | ✅ | update / remove |
| POST | `/alerts/trigger` | ✅ | create alert + enqueue notifications |
| POST | `/alerts/:id/location` | ✅ | append location fix |
| PATCH | `/alerts/:id/status` | ✅ | ack / resolve |
| GET | `/alerts` and `/alerts/:id` | ✅ | list / detail |
| GET/POST | `/tracking/:token(/:acknowledge)` | – | public tokenized tracking page |
| GET | `/notifications/:alertId/status` | ✅ | delivery status |
| POST | `/notifications/:alertId/retry` | admin | requeue failed deliveries |
| GET | `/admin/alerts`, `/admin/reports` | admin | monitoring dashboard |

Realtime (Socket.IO, `/socket.io`): `realtime:hello` on connect; `alert:location` updates and `alert:status` events in per-alert rooms; `updateLocation` throttled per socket.

## Production

Production is live: **web** `https://bsafe-zeta.vercel.app`, **API** `https://bsafe-api.onrender.com` (health: `/api/health`). See `docs/deployment.md` for the full runbook (env vars, build/start commands, post-deploy verification, ops notes).

## Status

All phases complete:

| Phase | What | Status |
| --- | --- | --- |
| 0 | Repo & env setup (workspaces, Vite/Nest, Prisma, Redis, realtime baseline) | ✅ |
| 1 | DB schema & ORM (users, contacts, alerts, locations, activity, deliveries) | ✅ |
| 2 | Firebase auth (SDK + ID-token guard + user sync + auth UI) | ✅ |
| 3 | Redis, caching & rate limiting (throttler + Redis storage + CacheService) | ✅ |
| 4 | Profile & emergency contacts CRUD | ✅ |
| 5 | Silent SOS trigger + live location streaming | ✅ |
| 6 | Notifications (Twilio SMS + SendGrid email via BullMQ) | ✅ |
| 7 | Alert status tracking + public contact tracking view | ✅ |
| 8 | Admin/monitoring dashboard | ✅ |
| 9 | Non-functional hardening (throttle audit, validation, responsive, latency) | ✅ |
| 10 | Deployment (Vercel + Render + Neon + Upstash) | ✅ |
| 11 | Documentation handoff | ✅ |

Phase details, decisions and known gaps live in `PHASE_LOG.md`.
