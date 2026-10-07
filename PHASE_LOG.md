# PHASE_LOG.md

Tracks progress through the phases defined in AGENTS.md.

## Phase 11 — Documentation Handoff

**Status:** SHIPPED & VERIFIED.

### What was built

- **README.md rewritten** — end-to-end: what bSafe is, tech stack, architecture (data flow + component diagram), local setup for a new developer (Node/npm, Docker Postgres on 5434, Redis, env files), database bootstrap (migrate + seed), scripts table, API route table, realtime notes, production deployment pointers, and full phase status.
- **Docs** — `docs/PRD.md` (requirements) and `docs/deployment.md` (production runbook) already in place from earlier phases; README links to them so a newcomer has setup → architecture → runbook.
- **Login page note** — added a visible disclaimer on `LoginPage.tsx` (sign-in and sign-up): the app is a demo/portfolio build, not a production safety product; no live emergency services are attached.

### What was tested

- `typecheck` / `lint` / `build` clean on both apps.
- Followed the README's setup path from a clean clone perspective (commands verified against repo state: `npm install`, `npm install-scripts approve …`, `prisma generate`, `docker compose up -d postgres`, `npm run dev`).
- Login page renders the disclaimer in both modes (sign in / sign up) without breaking the form.

### Known gaps / TODOs for next phase

- None — project is complete through Phase 11.

## Phase 10 — Deployment

**Status:** SHIPPED & VERIFIED.

### What was built

- **Backend live on Render** (`https://bsafe-api.onrender.com`, service `bsafe-api`): NestJS API with Firebase auth, Prisma→Neon, ioredis→Upstash, BullMQ notification queue. Build command (dashboard-set): `npm ci && npm install-scripts approve … && npm run build -w @bsafe/api`; start `npm run start -w @bsafe/api` (port 10000).
- **Frontend live on Vercel** (`https://bsafe-zeta.vercel.app`): Vite build of `apps/web`, rootDirectory `apps/web`, `VITE_API_URL=https://bsafe-api.onrender.com` baked into the bundle, framework auto-detected.
- **Managed datastores**: Neon Postgres `dry-hill-74512166` (migrations applied to `neondb`, the pooler target of the production `DATABASE_URL`); Upstash Redis (production `REDIS_URL`, `rediss://` TLS).
- **Production env/secrets** in Render dashboard (Firebase admin creds, `ADMIN_EMAILS`, `NOTIFICATIONS_DRY_RUN=true`, `WEB_BASE_URL`, `CORS_ORIGINS=https://bsafe-zeta.vercel.app`). Vercel env in project settings. No secrets in git (`.env` gitignored; `.env.example` documents keys).
- **Redis URL parsing bug fixed** (root cause of every failed deploy): ioredis only parses a connection URL when passed as a *string* argument; a `url` key inside an options object is silently ignored and ioredis falls back to `localhost:6379`. `redisConnection()` now parses `REDIS_URL` into `host`/`port`/`username`/`password`/`tls` so the spread works for both `new Redis({…})` and BullMQ's `connection`. Startup now logs the sanitized `REDIS_URL` host and the actual dial target for quick diagnosis.
- **Uptime monitoring**: `GET /api/health` returns `{"status":"ok","redis":"PONG",…}` (also exercises Redis); can be hit by any external pinger. Deployment runbook → `docs/deployment.md`.

### What was tested

- `curl https://bsafe-api.onrender.com/api/health` → 200 `{"status":"ok","redis":"PONG",…}`.
- CORS preflight from `Origin: https://bsafe-zeta.vercel.app` → `access-control-allow-origin` echoes the allowlisted origin (204).
- `https://bsafe-zeta.vercel.app/` → 200, `<title>bSafe</title>`, API base `https://bsafe-api.onrender.com` present in the served JS bundle.
- Redis dial verified: `Redis connecting to grateful-shiner-106986.upstash.io:6379` → `Redis connected` → `Nest application successfully started`.
- Local reproduction: `{ url }` object → `localhost:6379`; parsed host/port/tls → `PONG` against Upstash.

### Known gaps / TODOs

- **Leaflet tile provider**: swap the default demo/OSM tile layer for a production-grade provider (Mapbox/MapTiler) in the tracking view.
- **Visual responsive check on a physical phone** (Phase 9 leftover) — desktop/mobile emulation only so far.
- **BullMQ worker runs in-process** on the single API instance; split into a standalone worker container when scaling to multiple API instances.
- **Socket.IO**: gateway is single-instance (in-memory adapter); add the Socket.IO Redis adapter for multi-instance; ensure the reverse proxy (`ws`) terminates correctly in production.
- **Uptime pinger**: health endpoint is ready; no external pinger (e.g. UptimeRobot) wired up yet — recommended next step.

## Phase 9 — Non-Functional Hardening

**Status:** SHIPPED & VERIFIED — commit pending.

### What was done

- **Route rate-limit audit** — every REST route carries its own `@Throttle()` override (no bare global default): `/` 60, `/health` 60 per IP, `/auth/sync` 10, `/auth/me` 30, `/users/me` GET 30 / PATCH 10, `/contacts` GET 30 / POST·PATCH·DELETE 10, `/alerts/trigger` 5, `/alerts/:id/location` 60, `/alerts/:id/status` 20, `/alerts/:id` 30, `/alerts` 30, `/tracking/:token` GET 20 per IP / POST ack 10 per IP, `/notifications/:alertId/status` 30, `/notifications/:alertId/retry` 5 (Admin), `/admin/alerts` 30, `/admin/reports` 10. WebSocket `updateLocation` already throttled to 1/5s per socket in the gateway (not covered by throttler).
- **Validation/sanitization audit** — global `ValidationPipe(whitelist, forbidNonWhitelisted, transform)`; all `:id`/`:alertId` params use `ParseUUIDPipe`; tracking tokens are opaque and resolved only via service lookup; contact/user DTOs bound name/phone/email/relationship with `Length`/`Matches`/`IsEmail`; no `dangerouslySetInnerHTML` anywhere (React escapes all user data). No gaps found.
- **Prisma `@@map` snake_case tables** — added `@@map` to all 6 models (`users`, `emergency_contacts`, `alerts`, `alert_locations`, `activity_logs`, `notification_deliveries`), killing the Phase 8 PascalCase raw-SQL footgun. Migration is a hand-written `RENAME` (Prisma's `migrate dev` would have DROP+CREATE'd and lost data in non-interactive mode); data preserved and verified by matching ORM/raw counts. Raw SQL in `admin.service.ts` reverted to unqualified snake_case names.
- **Leaflet code-split** — `TrackAlertPage` lazy-loaded (`React.lazy` + Suspense). Leaflet now ships in its own ~154 kB chunk (`gzip 45 kB`) loaded only when a tracking link is opened; main bundle ~491 kB.
- **Mobile-responsive pass** — HomePage shell stacks on small screens (sidebar → top bar with horizontally scrolling nav; `lg:` restores the column layout); admin alerts table already wraps in `overflow-x-auto` with a `min-w-[820px]` table; tracking view is `max-w-md` centered with a full-width map; contacts/profile/login are centered `max-w-md`/`max-w-sm`. Verified responsive classes compile; visual pass on a real phone is a Phase 9 leftover (no device available).

### What was tested

- `typecheck` / `lint` / `build` clean on both apps.
- **Latency / load** (compiled app, local Postgres + Redis, N=30): alert create (dispatch incl. delivery enqueue) **avg 47 ms, p95 83 ms, max 117 ms** (<2 s acceptance met); location update **avg 13 ms, p95 19 ms, max 22 ms**.
- **Redis-backed throttling under repeated hits**: 70 rapid `GET /api/health` → 59×200 + 11×429 (60/min per IP). Storage is `RedisThrottlerStorage` (RedisService-backed), not in-memory.
- End-to-end SOS → notify → resolve flow was already exercised in Phase 6/7 probes; Phase 9 re-ran the full service stack (create, location stream, ack, resolve, admin reports) without regression.

### Known gaps / TODOs for next phase

- Phase 10 (deployment): visual responsive check on a physical phone; consider Pinia/downgrade of Leaflet tile provider for production; document the load numbers in `docs/deployment.md`.
- `migrate dev --create-only` is unusable in non-interactive shells (Prisma 7) — schema renames must be hand-written (as done here) or run via `script -qec`.

## Phase 8 — Admin/Monitoring Dashboard

**Status:** SHIPPED & VERIFIED — commit pending.

### What was built

- **Admin authorization**:
  - `users.is_admin` boolean column (migration `20260814161940_user_is_admin`).
  - `ADMIN_EMAILS` env allowlist — `AuthService.syncUser` grants `isAdmin` on every login for listed emails (new users, email-linked users, and existing users are promoted live). Exposed in `UserDto` so the UI can conditionally show the Admin nav.
  - `AdminGuard` (`common/guards/admin.guard.ts`) — runs after the global Firebase guard, 403 unless the caller's local user row has `is_admin`.
- **Admin API** (`apps/api/src/admin/`, both `@UseGuards(AdminGuard)` + own `@Throttle` per route table §3):
  - `GET /admin/alerts` (30/min) — cross-user alert table with filters (`status`, `from`, `to`, `userId`) + offset pagination; `acknowledgedAt` derived from the first `acknowledged` activity-log event; delivery sent/failed counts per alert.
  - `GET /admin/reports` (10/min) — read-only KPIs: totals, active-now (24h), ack rate, alerts/day (30-day raw-SQL series), avg time-to-acknowledge and avg time-to-resolve.
- **Notifications retry → admin** (route table §3): `POST /notifications/:alertId/retry` is now `AdminGuard`-gated via non-owner-scoped `retryFailedAdmin` (was owner-scoped). `GET .../status` stays owner-scoped.
- **Web**: `lib/admin.ts` hooks, `pages/admin/AdminDashboard.tsx` (KPI cards, 30-day bar chart, filterable alerts table, per-alert Retry for failed deliveries), `AdminRoute` (protected + admin-gated, 403-style screen for non-admins), `/admin` route, and an "Admin" nav link on Home shown only to admins.

### What was tested

- `typecheck` / `lint` / `build` clean on both apps.
- Service probe (compiled app, real Postgres + Redis, `ADMIN_EMAILS=admin@x.io,listed@x.io`): listed → admin, non-listed → not; existing listed user promoted on re-sync; AdminGuard allows admin / 403 non-admin / 403 no claims; `listAlerts` maps user, acknowledgedAt (from activity log), location/delivery counts and honors status/userId/date filters; `getReports` returns totals + ack rate + per-day series + avg ack minutes; `retryFailedAdmin` requeues exactly the failed delivery (status→queued, attempts→0, error cleared). 21/21 PASS.
- Boot smoke over HTTP (Firebase configured): admin routes + retry route → 401 unauthenticated and with a fake token; `/api/health` control → 200. (403 admin-allow path can't be exercised end-to-end without a real Firebase login — covered by the guard probe.)

### Notes

- **Prisma 7 quirk (bit us in raw SQL):** default table names are PascalCase — `Alert`, `ActivityLog`, `User`, … (no `@@map` on models; only columns are mapped to snake_case). Raw `$queryRaw` SQL must quote the real names (`FROM "Alert"`). The ORM qualifies automatically, which is why only hand-written SQL broke. Worth a `@@map` pass in Phase 9 or documenting in the README.
- Admin is driven by an email allowlist + DB flag (Firebase is auth-only by design — no custom claims). Promote by adding the email to `ADMIN_EMAILS` and having them log in once.
- `profile` cache is 60s, so an admin flag change propagates within a minute.

### Known gaps / TODOs for next phase

- Phase 9 (hardening): add `@@map` snake_case table names to kill the raw-SQL gotcha; mobile-responsive pass on the admin table (already scrollable, verify on small screens); code-split Leaflet; validate all routes have their own `@Throttle`; load-check the location-update path.

## Phase 7 — Alert Status Tracking & Contact View

**Status:** SHIPPED & VERIFIED — commit pending.

### What was built

- **API — tracking module** (`apps/api/src/tracking/`):
  - `GET /tracking/:token` — public, 20/min per IP. Returns the alert's status, the triggerer's name, `triggeredAt`/`resolvedAt`, and the last known location. Unguessable UUID token; payload is view-only (no alert IDs of others, no contact/phone data).
  - `POST /tracking/:token/acknowledge` — public, 10/min per IP. Moves `sent → acknowledged` (400 if already acknowledged or resolved) and logs `acknowledged` by actor `contact`.
  - Both `@Public()` — the global Firebase guard skips them, so the throttler tracks per-IP (unauthenticated).
  - A resolved alert still resolves the link but returns its final state — the "expiry" behavior: the live map stops updating and the page shows the resolved state.
  - `activity_logs` now records `triggered → acknowledged → resolved` for the full contact-driven lifecycle.
- **Web**:
  - Public route `/track/:token` (`TrackAlertPage`) — mobile-first dark theme: status badge (ACTIVE / ACKNOWLEDGED / RESOLVED), "who triggered at when", a live Leaflet map (OpenStreetMap tiles, pulsing div-icon pin, no asset-path issues), timestamps, and an **Acknowledge** button shown only while `sent`.
  - `LiveMap.tsx` — Leaflet wrapper (create-once, recenter + marker update on location change, cleanup on unmount).
  - `lib/tracking.ts` — `useTracking` polls every 12s and stops once resolved; `useAcknowledgeTracking` mutation.
- Deps: `leaflet` + `@types/leaflet` in `apps/web`.

### What was tested

- `typecheck` / `lint` / `build` clean on both apps (web shows only the usual >500 kB chunk warning from bundling Leaflet — code-split candidate for Phase 9).
- Service probe (compiled app, real Postgres + Redis): view → `sent` with userName/triggeredAt and no location; `addLocation` → lastLocation reflected; acknowledge → `acknowledged`; re-acknowledge → 400; resolve → `resolvedAt` set; acknowledge-after-resolve → 400; bad token → 404; activity events exactly `triggered,acknowledged,resolved`.
- Boot smoke over HTTP (no auth header): public `GET /api/tracking/:token` → 200 with correct payload; acknowledge → 200 then status `acknowledged`; invalid token → 404; acknowledge on a resolved alert → 400; per-IP throttle kicks in (~20/min → 429 on continued requests).

### Notes

- "Expires when resolved" is implemented as *stops live-updating and shows the resolved state* rather than returning 410 — a contact who opens an old SMS later still sees the outcome (resolved + timestamp), which is the safer UX.
- The acknowledge actor is a generic `contact` (no identity on a public page). Phase 8's admin view can see the transition timeline.
- Tracking page polls REST (12s) — Socket.IO is auth-gated to the owner, so contacts get near-real-time via polling instead.

### Known gaps / TODOs for next phase

- Phase 8 (optional): admin dashboard — cross-user alert table, delivery/ack/resolution KPIs; the `/notifications/:alertId/retry` route becomes admin-gated then.
- Code-split Leaflet (dynamic import) to slim the web bundle.
- The owner's own UI does not yet surface per-contact delivery status — a small status list on the alert screen (Phase 9 polish).

## Phase 6 — Notifications (Twilio SMS + SendGrid email via BullMQ)

**Status:** SHIPPED & VERIFIED — commit pending.

### What was built

- **Schema** — `NotificationDelivery` model (`alert_id`, `contact_id`, `channel` enum, `status` enum `queued|sent|failed`, `attempts`, `last_error`, `sent_at`) with `@@unique([alertId, contactId, channel])`; relations added to `Alert` and `EmergencyContact`. Migration `20260814154347_notification_deliveries`.
- **Providers** (`notifications/providers/`):
  - `TwilioSmsProvider` — Twilio Messaging Service; phone normalized to E.164 at send time (contacts allow loose formats today).
  - `SendGridEmailProvider` — `@sendgrid/mail`; requires `SENDGRID_FROM_EMAIL` in real mode.
  - **Dry-run by default** (`NOTIFICATIONS_DRY_RUN=true`): logs the would-be SMS/email and marks the delivery `sent` without any provider call — prevents accidental charges in dev; set `false` in staging for real sends (acceptance).
- **BullMQ worker** (`notifications.processor.ts`) — in-process worker (concurrency 5) on the `notifications` queue: increments `attempts`, dispatches to the right provider, marks `sent` on success; on failure marks `failed` only after BullMQ exhausts its default `3` attempts with exponential 5s backoff.
- **`NotificationsService`** — `enqueueForAlert` (creates a `queued` delivery row per contact per reachable channel, then enqueues one BullMQ job each — never dispatched synchronously from the request thread), `getStatus` (owner-scoped, with contact name), `retryFailed` (resets `failed` → `queued`, clears error, re-enqueues), plus `beginAttempt` / `markSent` / `markFailed`.
- **`NotificationsController`** — `GET /notifications/:alertId/status` (30/min) and `POST /notifications/:alertId/retry` (5/min); both owner-scoped (retry becomes admin-only in Phase 8).
- **Hook** — `AlertsService.create()` now enqueues notifications right after the alert is created (fast queued-row writes; the async dispatch happens in the worker).
- **Env** — added `WEB_BASE_URL` (builds the `/track/:token` tracking link), `NOTIFICATIONS_DRY_RUN`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` to `.env.example`.

### What was tested

- `typecheck` / `lint` / `build` clean on both apps.
- Dry-run integration probe (compiled app, real Postgres + Redis): user with a phone-only, an email-only, and a both-channel contact → exactly **4** delivery rows (2 sms + 2 email) all `sent` with `attempts=1`; the both-contact gets independent per-channel rows; `getStatus` returns contact names; a non-owner is denied.
- Provider-failure path: stub provider throws → delivery `failed` after **3** attempts with `last_error` set; `retryFailed` resets it to `queued`, `attempts=0`, error cleared, and re-enqueues 1 job.
- Boot smoke: `/api/health` 200; both `/notifications` routes 401 unauthenticated; the worker logs `notifications worker started (twilio-dry-run / sendgrid-dry-run)`.

### Trade-offs / notes

- `retry` is owner-scoped for now; the route table says Admin — swap to the admin guard in Phase 8.
- "sent" means accepted by the provider (Twilio `messages.create` is an async enqueue; SendGrid API accept) — actual delivery confirmation (webhooks) is intentionally out of scope; this matches PRD "sent ≠ delivered".
- Worker runs in-process for simplicity; split into a standalone process/container when scaling to multiple API instances (Phase 10).
- Contact phone normalization to E.164 happens at send time; tightening the Phase 4 contact validation is a Phase 9 hardening item.
- The tracking link is already baked into both SMS/email bodies and "expires" semantically once the alert resolves — the actual expiry behavior is implemented in Phase 7 (tracking page shows resolved/closed state for resolved alerts).

### Known gaps / TODOs for next phase

- Phase 7: public `/track/:token` page (live map + status + timestamps + acknowledge) — the tokenized link the notifications carry.
- Delivery status visibility for the alert owner in the web UI (the API endpoint exists; no screen yet).
- Real staging send (dry-run off) requires confirmed Twilio/SendGrid sender/from values.

## Phase 5 — Core SOS Trigger + Live Location

**Status:** SHIPPED & VERIFIED — commit pending.

### What was built

- **API — Alerts** (`apps/api/src/alerts/`):
  - `POST /alerts/trigger` (5/min) — fires a silent SOS, creates the alert in `sent`, records an initial fix when the client could grab one, writes a `triggered` activity log.
  - `POST /alerts/:id/location` (60/min) — REST fallback location ping; persists to `alert_locations` and promotes it to `alerts.last_location_id`. Rejected (409) once the alert is resolved.
  - `PATCH /alerts/:id/status` (20/min) — `sent → acknowledged → resolved` transitions with validation (`re-ack` and `re-resolve` → 400), sets `resolved_at`, logs each transition.
  - `GET /alerts/:id` (30/min) and `GET /alerts` (30/min) — detail/history with `lastLocation` + `locationCount`; ownership-scoped (404 for others' alerts).
  - **`AlertsGateway`** (Socket.IO, default path): handshake middleware requires a valid Firebase ID token **and** a local user row, resolving the local UUID once into `socket.data.userId`; `joinAlert` (ownership-checked) joins room `alert:{id}`; `updateLocation` throttled to one per 5s per socket, persisted, then broadcast as `location:update` to the alert room. Connection without a token is rejected.
- **shared-types**: `AlertLocationDto`, richer `AlertDto` (`lastLocation`, `locationCount`), `AlertListItemDto`, `TriggerType`, `TriggerAlertInput`, `UpdateLocationInput`, `AlertStatusUpdate`.
- **Web**:
  - `hooks/useGeolocation.ts` — permission requested only via `requestPermission()` (onboarding, never at trigger time); high-accuracy `watchPosition`; degraded handling: denied/unsupported → last-known position retained for degraded sharing.
  - `components/SosButton.tsx` — silent trigger: single tap **and** 600ms long-press both fire; the only feedback on success is the button dimming (no sound, no modal, no animation).
  - `components/SosPanel.tsx` — location-onboarding card (Enable / degraded note), SOS gate (needs ≥1 contact), trigger, and the live stream: 12s `watchPosition` pushes over WebSocket with automatic REST fallback, last-known pushed when the tab backgrounds, streaming stops on resolve (polled via `useAlert`), active alert id persisted to `localStorage` so streaming survives refresh.
  - `lib/alerts.ts` (trigger/alert/list/status hooks + REST fallback), `lib/alertSocket.ts` (socket.io-client wrapper).
  - Vite proxies `/socket.io` (ws: true) → :3000 so the client stays same-origin.

### What was tested

- `typecheck` / `lint` / `build` clean on both apps.
- REST lifecycle probe (compiled `AlertsService` vs seeded Postgres): trigger with initial fix (count 1, lastLocation set), `addLocation` bumps `lastLocation`, cross-user access → 404, ack → `acknowledged`, re-ack → 400, resolve → `resolved_at` set, location-after-resolve → 409, re-resolve → 400, activity log `triggered → acknowledged → resolved`, history listing works.
- **Socket.IO integration test** (real app booted via `@nestjs/testing` with a stubbed token verifier, real Postgres + Redis): token-authenticated connect → `joinAlert` ack → `updateLocation` ack + `location:update` broadcast received in-room + row persisted (count 2) → immediate 2nd ping rejected (no persist, no broadcast) → ping after resolve rejected (no persist, no broadcast).
- Boot smoke against the real stack: `/api/health` 200; all `/alerts` + `/contacts` routes 401 without a token; Socket.IO handshake without a token rejected ("Missing Firebase token"); gateway log shows `joinAlert`/`updateLocation` subscriptions.

### Bug caught & fixed (latent from Phase 4)

- Controllers/gateway were passing the **Firebase uid** to services that key rows by the **local user UUID** (FK `user_id` → `users.id`). With a real token this would 500/FK-fail. Added `UsersService.resolveLocalUserId(firebaseUid)` (reuses the 60s profile cache) and wired it into `ContactsController`, `AlertsController`, and the gateway's connect middleware (resolved once per socket). Phase 4 probes bypassed this because they called services with the local id directly — real-token E2E would have caught it earlier; noted for Phase 9 manual walkthrough.

### Rate-limit trade-off (per `BACKEND_FILES_AND_ROUTES.md` §4)

- Kept the suggested `POST /alerts/trigger` 5/min — high enough for a genuine re-trigger, low enough to blunt abuse. Revisit after Phase 9 load testing.

### Known gaps / TODOs for next phase

- Nest's default WsException filter serializes rejected socket messages as a generic "Internal server error" (throttle/conflict details are hidden from the client). The web client treats socket failures as a REST-fallback trigger, so this is cosmetic today; a custom `WsExceptionFilter` can be added in Phase 9 hardening.
- Gateway throttle is in-memory per instance (fine single-instance); Socket.IO Redis adapter deferred to Phase 10 (multi-instance).
- No browser E2E yet — needs a real Firebase account + geolocation to click through the full trigger → stream → resolve loop (manual walkthrough for Phase 9).
- `activity_logs.actor` stores `user:{localUuid}`; contact-acknowledge actors land in Phase 7.
- WebSocket auto-reconnect uses Socket.IO defaults; token refresh mid-alert reconnects with a fresh token on the next mount (a long alert >1h would need a token-refresh listener — Phase 9 hardening).

## Phase 4 — User Profile & Emergency Contacts

**Status:** SHIPPED & VERIFIED — commit pending.

### What was built

- **API — Users** (`apps/api/src/users/`): `GET /users/me` (30/min per user, profile cached 60s, reuses the `profile:{firebaseUid}` key) and `PATCH /users/me` (10/min, update name/phone, cache invalidated). `UpdateUserDto` with name length + E.164-ish phone validation.
- **API — Contacts** (`apps/api/src/contacts/`): full `GET` (30/min, cached 30s), `POST` (10/min), `PATCH :id`, `DELETE :id` (10/min).
  - Create requires phone **or** email (400 otherwise), enforces a 5-contact cap (400), and rejects duplicates by phone/email (409, unique-constraint backstop + P2002 catch). Ownership-scoped lookups (other users' contacts → 404, no existence leak).
  - Every write (`POST`/`PATCH`/`DELETE`) invalidates `contacts:{userId}`; reads populate it with a 30s TTL.
  - `CreateContactDto`/`UpdateContactDto` validated by the global `ValidationPipe` (whitelist + forbidNonWhitelisted).
- **Web**: `lib/users.ts` (`useProfile` now hits `GET /users/me`, `useUpdateProfile` PATCH + invalidate), `lib/contacts.ts` (`useContacts`, `useCreateContact`, `useUpdateContact`, `useDeleteContact` — all write mutations invalidate the `contacts` query).
  - `ContactsPage` (`/contacts`): list + add/edit/remove, inline forms, error surfacing, counter `n/5`, add-form disabled at the cap.
  - `ProfilePage` (`/me`): edit name/phone, form keyed by profile id (no sync-setState-in-render).
  - `HomePage`: nav (home/contacts/profile), SOS section **blocked with zero contacts** (CTA to add one) and shown ready-but-inert with ≥1.

### What was tested

- `npm run typecheck` / `lint` / `build` clean on both apps.
- Boot smoke (Redis + Firebase + Postgres configured): `GET /api/health` 200; `GET/POST /api/contacts` and `GET /api/users/me` without a token → 401 "Missing or malformed Authorization header".
- Real-stack probe against compiled services + seeded DB: empty list, create populates cache (30s TTL), duplicate phone/email → 409, 6th contact → 400 "Maximum of 5 contacts allowed", `PATCH`/`DELETE` invalidate the contacts cache, deleted row gone, profile cache populated/invalidated on `PATCH /users/me`. Cache serve proven by seeding a marker and reading it back through `list()`.

### Known gaps / TODOs for next phase

- Phone provider (recaptcha) OTP not in scope on web — email/password only.
- SOS reaching the trigger surface (Phase 5) is still gated/placeholder on HomePage.
- Contact list ordering is `createdAt asc` — no pinning/reordering yet.

## Phase 3 — Redis, Caching & Rate Limiting

**Status:** SHIPPED & VERIFIED — commit pending.

### What was built

- **Redis-backed throttler** (`apps/api/src/redis/redis-throttler.storage.ts`): custom `ThrottlerStorage` implementing the `@nestjs/throttler` v6 interface over the shared `RedisService` (INCR + EX window + PX block flag). Used instead of `nestjs-throttler-storage-redis`, whose latest release peers only to `@nestjs/common <=10`.
- **Global `ThrottlerModule`** (`forRootAsync`, Redis storage, default 60/60s) + global `ThrottlerGuard` as `APP_GUARD`; `getTracker` prefers `request.firebaseUser.uid` (per-user) then `request.ip` (per-IP).
- **Global `FirebaseAuthGuard`** (was controller-level): now an `APP_GUARD` registered before the throttler so `firebaseUser` is set first, giving true per-user tracking. New `@Public()` decorator bypasses auth (health, root); public routes are throttled per-IP.
- **Per-route `@Throttle` overrides** on every existing route (none on the bare default): `GET /api` 60/min, `GET /health` 60/min per IP, `POST /auth/sync` 10/min per IP (per-route `getTracker`), `GET /auth/me` 30/min per user.
- **`CacheService`** (`apps/api/src/cache/`): JSON cache over Redis (`bsafe:cache:*`), `get/set/del/delByPrefix`, wired into `AuthService.findByFirebaseUid` (`profile:{uid}`, 60s TTL, invalidated on `syncUser` write paths).
- **BullMQ notifications queue** (`apps/api/src/notifications/`): `notifications` Queue provider on Redis, exponential-backoff default job options (3 attempts, 5s), `OnModuleDestroy` close — provisioned now, enqueued/consumed from Phase 6.

### What was tested

- `npm run typecheck` / `lint` / `build` on `@bsafe/api` all clean.
- Boot smoke (Redis + Firebase configured): `GET /api/health` 200; 60-hit burst then 429 with `Retry-After` header; Redis shows `throttler:*` counter + block keys.
- `GET /api/auth/me` without token → 401 "Missing or malformed Authorization header" (global auth guard order intact).
- CacheService probe via dist: set→read hit, `del`→miss, `delByPrefix('contacts:')` wipes all matching keys.

### Known gaps / TODOs for next phase

- Contacts cache + invalidation (`contacts:{uid}`, 30s TTL, invalidated on POST/PATCH/DELETE) lands in Phase 4 with the contacts CRUD routes.
- `/auth/sync` is kept per-IP to match the route table even though it is authenticated (per-route `getTracker` override); `/auth/me` is per-user.
- BullMQ worker (Twilio/SendGrid processors) and `notification_deliveries` table are Phase 6.
- WebSocket gateway (Phase 5) needs its own manual throttling — not covered by `@nestjs/throttler`.

## Phase 2 — Authentication (Firebase)

**Status:** SHIPPED & VERIFIED — commit in progress.

### What was built

- **API — Firebase Admin SDK** (`apps/api/src/auth/firebase-admin.service.ts`): modular firebase-admin v13 API; app only initialised when all three `FIREBASE_*` env vars are set, otherwise auth endpoints return 503 (dev without credentials still boots).
- **API — `FirebaseAuthGuard`** (`apps/api/src/common/guards/firebase-auth.guard.ts`): verifies `Authorization: Bearer <Firebase ID token>`, attaches decoded claims to `request.firebaseUser`. 401 on missing/invalid token, 503 when unconfigured.
- **API — `@CurrentUser()` decorator** (`apps/api/src/common/decorators/current-user.decorator.ts`): extracts claims or a single claim (e.g. `@CurrentUser('uid')`).
- **API — `AuthModule`**: `POST /api/auth/sync` (verify token → create/link local `users` row via `firebase_uid`, P2002-safe upsert, links by email if an email-matching row exists) and `GET /api/auth/me` (current local user). Both return `UserDto` from `@bsafe/shared-types` (now a workspace dep of the API).
- **Web — auth plumbing**: `lib/firebase.ts` (unchanged baseline) + new `lib/auth-context.ts` / `lib/auth.tsx` (AuthProvider) / `lib/useAuth.ts` (split so react-refresh stays clean), tracking `onAuthStateChanged`.
- **Web — profile hook** (`lib/profile.ts`): react-query `useProfile()` → `POST /api/auth/sync` (idempotent upsert) returning `UserDto`.
- **Web — UI**: `/login` page (email/password sign in & sign up, Firebase-unconfigured notice), `ProtectedRoute` wrapper, `HomePage` shell (profile + contact count + sign out); router split into public + protected routes.

### What was tested

- `npm run lint` / `typecheck` / `build` pass for `@bsafe/api`, `@bsafe/web`, `@bsafe/shared-types`.
- API boots: `/api/health` OK (Redis PONG); `GET /api/auth/me` without a token → 401 "Missing or malformed Authorization header".
- Web production build passes (Vite).

### Known gaps / TODOs for next phase

- Phone OTP auth not implemented (email/password only for now — PRD allows either).
- Socket.IO handshake still unauthenticated (Phase 2 TODO in realtime baseline): must verify `client.handshake.auth.token`.
- Full sign-up → login → `/me` → logout flow needs live Firebase credentials + email/password provider enabled to verify end to end.

## Phase 1 — Database Schema & ORM

**Status:** SHIPPED & COMMITTED (`phase(1)`).

### What was built

- Prisma migration `20260813145830_init` (written via `prisma migrate dev`): `users`, `emergency_contacts`, `alerts`, `alert_locations`, `activity_logs` + `AlertStatus` enum (`sent|acknowledged|resolved`).
- Unique + FK constraints: user email/phone/firebase_uid; contact `(user_id, phone)` / `(user_id, email)`; alert `tracking_token`, `last_location_id`; location index `(alert_id, recorded_at)`; all relations `ON DELETE CASCADE` except `Alert.last_location_id → SET NULL`.
- `prisma/seed.ts` (idempotent, `npm run prisma:seed`): 2 users, 6 contacts, 3 alerts covering all three statuses, 10 locations (movement trails), 8 activity logs; `last_location_id` wired to the newest location per alert.
- `docs/er-diagram.png` regenerated from a reproducible generator (`docs/generate_er_diagram.py`, PIL-only, no graphviz needed).
- `.prettierignore` gains `*.py` + `prisma/migrations/*/*.sql`.

### What was tested

- `prisma migrate dev` created + applied the migration on a fresh container DB (5434); `prisma migrate status` → up to date.
- Seed reruns cleanly (idempotent); verified via psql: per-user contact/alert counts, per-status alert distribution, 10 locations / 8 logs, zero orphan rows, correct `last_location_id` links.
- `npm run typecheck`, `npm run lint`, `npm run build` all pass; Prettier clean.

### Known gaps / TODOs for next phase

- No `notification_deliveries` table yet (Phase 6 — intentionally deferred with migrations).
- ER diagram is a static render from the script; re-run `docs/generate_er_diagram.py` if the schema changes.

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

---

## 2026-08-15 — SMS delivery diagnosis & fix (INSTRUCTIONS.md)

**Root cause:** phone-format bug, not the pipeline. Contacts saved without a country code
(e.g. `9538142453`) had `+` blindly prepended by `toE164()` in `twilio.provider.ts`,
producing invalid E.164 `+9538142453` → Twilio rejected with *"The 'To' number +953814**** is not a valid phone number."*

**Evidence (Render `bsafe-api` logs + production Neon DB):**
- Worker correctly started as `(twilio / sendgrid)` after `NOTIFICATIONS_DRY_RUN=false` took effect (env is read once at boot — needed a real redeploy).
- SMS to `+919110621698` → `sent` (Twilio accepted, `sid=SMda…`).
- SMS to `9538142453` → `failed` (invalid To), all 3 attempts.
- Email → `failed: Forbidden` — SendGrid account-side (separate issue: sender verification / API key scope), NOT part of this fix.

**Fixes:**
- Tightened `create-contact.dto.ts` + `update-contact.dto.ts` phone regex to `/^\+[1-9]\d{7,14}$/` (country code required).
- Added matching client-side validation + error message in `ContactsPage.tsx`.
- Updated the stored prod contact `0a0fa5e8…` phone `9538142453` → `+919538142453`.

**Follow-ups:**
- Re-trigger a test alert end-to-end; confirm SMS shows `sent` and is received on the test phone.
- SendGrid `Forbidden` still needs account-side fix (verify `bsafe.dev@gmail.com` sender + API key Mail Send scope).
- On a fresh DB the stricter regex is enforced at DTO level; existing bad data must be migrated (only 1 row, already fixed).

---

## 2026-08-16 — Twilio provider: direct-from trial number (no Messaging Service)

**Change:** SMS now sends with `from: TWILIO_PHONE_NUMBER` instead of `messagingServiceSid`.
A free Twilio trial ships a trial number out of the box, so requiring a Messaging
Service added setup friction for no benefit. `TWILIO_MESSAGING_SERVICE_SID` is
replaced by `TWILIO_PHONE_NUMBER` (normalized through `toE164`, so `+1 (447) 213-5457`
is accepted).

**Files:** `apps/api/src/notifications/providers/twilio.provider.ts`,
`apps/api/.env.example`, `docs/deployment.md`, local `apps/api/.env` (gitignored).

**Preserved:** the `SmsProvider` interface (`name` + `sendSms`) and
`NOTIFICATIONS_DRY_RUN` behaviour are unchanged.

**Verified:** lint + typecheck + build pass. Dry-run provider still short-circuits;
missing-credential error names `TWILIO_PHONE_NUMBER`; real provider builds from the
new variable alone.

**Blocked (account-side, not code):** the Twilio account now returns
`401 — account <AC…> with status 4 is not active`, so no live SMS can be sent
until the trial is reactivated/upgraded. Re-test the send path after that. Trial
accounts also require every recipient to be a Verified Caller ID (error 21608
otherwise).
