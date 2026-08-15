# WORKING.md — How bSafe works

bSafe is a web-based **silent SOS** system: a user in danger triggers an alert with a
single tap or long-press (zero sound, zero on-device confirmation), which streams their
live location to pre-configured trusted contacts and tracks the alert until resolved.

This file explains the **logic and end-to-end workflow** of the project. For setup,
stack and deployment, see `README.md`; for requirements, see `docs/PRD.md`.

---

## 1. High-level architecture

```
┌────────────────────────┐         ┌──────────────────────────────┐
│  apps/web  (React SPA) │         │  apps/api   (NestJS 11)      │
│  Firebase Auth (only)  │  HTTPS  │  Firebase Admin (verify JWT) │
│  TanStack Query        │ ──────► │  Prisma 7 → PostgreSQL       │
│  Socket.IO client      │ ◄────── │  Socket.IO gateway           │
│  Leaflet map           │  WS     │  BullMQ → Redis → Twilio/    │
└────────────────────────┘         │              SendGrid worker │
                                   └──────────────────────────────┘
        infra: PostgreSQL (Neon), Redis (Upstash), Twilio SMS,
               SendGrid email, Vercel (web), Render (api)
```

Two databases in the Neon project (`neondb` = production target, `bsafe` = leftover
duplicate). `packages/shared-types` holds the DTOs shared by web and api.

---

## 2. Data model (Prisma → PostgreSQL)

| Table | Purpose | Key fields / relations |
|---|---|---|
| `users` | Local account rows, keyed by Firebase uid | `firebase_uid` unique, `is_admin` |
| `emergency_contacts` | Trusted contacts (max 5/user) | `user_id`, `phone`/`email` unique per user |
| `alerts` | One row per SOS trigger | `status` (sent/acknowledged/resolved), `tracking_token` (UUID), `last_location_id` |
| `alert_locations` | **Continuous** location history | `alert_id`, `lat`, `lng`, `accuracy`, `recorded_at` |
| `activity_logs` | Audit trail of status transitions | `alert_id`, `event_type` (triggered/acknowledged/resolved), `actor` |
| `notification_deliveries` | Per-contact, per-channel delivery state | `channel` (sms/email), `status` (queued/sent/failed), `attempts` |

Enums: `AlertStatus = sent | acknowledged | resolved`, `NotificationChannel = sms | email`,
`NotificationStatus = queued | sent | failed`.

---

## 3. Authentication & user identity (the two-row model)

**Firebase handles auth only**; the app keeps its own identity via a *local* `users` row.

1. The user signs in with email/password **or Google** in `apps/web` (`lib/auth.tsx`).
2. On every successful sign-in, the web app calls `POST /api/auth/sync` with the
   Firebase ID token in `Authorization: Bearer <token>`. This creates-or-links the
   local `users` row, keyed by `firebase_uid` (idempotent; also promotes admin emails
   listed in `ADMIN_EMAILS`).
3. The `AuthProvider` exposes a `syncing` flag; `ProtectedRoute`/`AdminRoute` hold the
   UI until sync completes, so `/contacts`, `/users/me`, etc. never 404 with
   "No local user record — call POST /auth/sync first."

**Two identifiers matter and must not be confused:**

- `firebase_uid` — the Firebase identity, comes from the ID token.
- local `user.id` (UUID) — the FK used by `emergency_contacts.user_id` and `alerts.user_id`.

Every controller receives the `uid` from the token and resolves it via
`UsersService.resolveLocalUserId(uid)` (cached 60s) before touching contacts/alerts.

### Guards (global, in `app.module.ts`)

- `FirebaseAuthGuard` (runs first): verifies the Bearer token → attaches `request.firebaseUser`.
  Routes marked `@Public()` (only `/tracking/*` and `/health`) skip it.
- `ThrottlerGuard`: Redis-backed rate limiting, tracked **per-user** when authenticated,
  per-IP otherwise. Every route declares its own `@Throttle()` override.

---

## 4. Contacts (Phase 4)

- `GET/POST/PATCH/DELETE /api/contacts` — CRUD on `emergency_contacts`.
- Rules: max **5** contacts per user; each contact needs phone and/or email; no duplicate
  phone or email within a user (unique constraints are the backstop).
- `GET` result is cached in Redis 30s (`contacts:<userId>`) and invalidated on every
  write.
- **SOS is disabled until the user has ≥ 1 contact** (`SosPanel` blocks the trigger and
  the API relies on the UI gate).

---

## 5. SOS trigger + live location (Phase 5) — the core loop

### 5a. Geofence permission up-front, not at crisis time

`useGeolocation` (`hooks/useGeolocation.ts`) requests the browser permission during setup,
so the SOS moment never blocks on a permission prompt. States: `idle → prompting → granted |
denied | unavailable`. Degraded handling:

- `denied` → SOS shares only the **last known** position.
- `unavailable` (GPS off) → uses last known position.
- backgrounded tab → pushes last-known once so contacts keep a fix.

### 5b. Silent trigger

`SosButton` supports **single tap** and **long-press (600ms)** — both fire the same alert.
Feedback is intentionally minimal: the button dims and its ring fades. No sound, no modal,
no success animation (hard UX constraint).

### 5c. Alert lifecycle

1. `POST /api/alerts/trigger` → `AlertsService.create()`:
   - Creates the alert in `sent` state (a `tracking_token` UUID is auto-generated).
   - Writes the first location fix if the client had one.
   - Enqueues notifications (see §6) — **never synchronously**.
   - The active alert id is persisted in `localStorage` (`bsafe.activeAlertId`) so a
     page refresh resumes streaming.
2. **Live streaming loop** (`SosPanel` effect):
   - Every **12s** it pushes a fix via a **Socket.IO** socket (`alert:updateLocation`),
     joined to the room `alert:<id>`.
   - The gateway **throttles to one ping per 5s** per socket and **persists each fix**
     to `alert_locations`, promoting it to `alerts.last_location_id`.
   - If the socket is down (or was never up), it falls back to `POST /api/alerts/:id/location`
     (REST). The loop stops when the alert is `resolved`.
3. **Status transitions** (`PATCH /api/alerts/:id/status`):
   - `sent → acknowledged` (owner, or a contact via the tracking link).
   - `sent|acknowledged → resolved` (owner; `resolvedAt` set). Resolving stops streaming.
   - Every transition writes an `activity_logs` row.

The owner can also watch an alert via `GET /api/alerts/:id` (polls 15s while active) and
its WebSocket room (`location:update` events).

---

## 6. Notifications (Phase 6) — async via BullMQ

Sending is **never synchronous** with the HTTP request.

1. On alert creation, `NotificationsService.enqueueForAlert()`:
   - For each contact and each reachable channel (phone → sms, email → email), creates a
     `notification_deliveries` row in `queued` and adds a BullMQ `notify` job carrying the
     contact + a **tokenized tracking URL** (`/track/<tracking_token>`).
2. The **BullMQ worker** (`notifications.processor.ts`) picks jobs off the `notifications`
   queue (concurrency 5, exponential-backoff retries, max ~3 attempts):
   - SMS → Twilio (`twilio.provider.ts`), email → SendGrid (`sendgrid.provider.ts`).
   - Delivery row moves `queued → sent` (handed to provider; "sent" ≠ "delivered") or
     `queued → failed` once retries are exhausted (`lastError` recorded).
   - **Dry-run by default** (`NOTIFICATIONS_DRY_RUN=true`) — providers log instead of
     sending until real Twilio/SendGrid credentials are set.
3. `GET /api/alerts/:id/notifications` returns per-contact, per-channel delivery status.
   Admin can re-queue failed deliveries (`POST /api/admin/alerts/:id/retry`).

---

## 7. Contact view — the tracking link (Phase 7)

- The SMS/email contains `<WEB_BASE_URL>/track/<tracking_token>` (e.g.
  `https://bsafe-zeta.vercel.app/track/<uuid>`).
- `GET /api/tracking/:token` and `POST /api/tracking/:token/acknowledge` are the only
  **public** endpoints (`@Public()`). The token is an unguessable UUID; the payload is
  **view-only** — no alert ids, no contact data, no phone numbers. Limits are per-IP.
- `TrackAlertPage` shows: the user's name, triggered time, a **Leaflet map** of the last
  known location, and a status pill. While the alert is active it **polls every 12s**.
- A contact can **acknowledge** (`sent → acknowledged`) — logged with `actor: 'contact'`.
- Once `resolved`, the map "expires" (stops updating) and shows the resolution time.

---

## 8. Admin dashboard (Phase 8, optional scope)

- `/api/admin/*` is protected by `AdminGuard` (requires `is_admin` on the local user row).
- `AdminDashboard` shows a filterable, paginated cross-user alert table (status, user,
  triggered/acknowledged/resolved times, location count, delivery sent/failed) plus
  read-only KPIs: alerts/day (30d), avg ack time, avg resolve time, ack rate, active now.

---

## 9. Caching & rate limiting (Phase 3)

**Redis (`CacheService`)** — thin JSON cache, prefix `bsafe:cache:`:

- `profile:<firebaseUid>` — 60s TTL; invalidated on profile update / admin promotion.
- `contacts:<userId>` — 30s TTL; invalidated on POST/PATCH/DELETE.
- `delByPrefix` used to sweep `contacts:*` on bulk changes.

**Rate limiting (`@nestjs/throttler` + `nestjs-throttler-storage-redis`)** — global
default 60 req/min/user; every route overrides it. Notable limits:
trigger 5/min, location ping 60/min, status update 20/min, tracking GET 20/min/IP,
tracking acknowledge 10/min/IP, auth sync 10/min/IP. The WebSocket path throttles
**manually** (5s/fix/socket) because `@nestjs/throttler` does not cover it.

---

## 10. Realtime (Socket.IO)

- `AlertsGateway` (`/socket.io`, CORS = `CORS_ORIGINS`).
- **Handshake is authenticated**: it rejects the connection unless a valid Firebase ID
  token is supplied and the account has a local user row (`socket.data.userId` resolved
  once here).
- Client flow (`lib/alertSocket.ts`): open socket with `{ auth: { token } }` →
  `joinAlert` (ownership-checked) → `updateLocation` every 12s → server persists + emits
  `location:update` to the alert room. `connect_error` → REST fallback.
- The Vite dev server proxies `/socket.io` (ws: true) → :3000 so dev stays same-origin.

---

## 11. End-to-end walkthrough (happy path)

1. **Onboarding**: user signs up (email/password or Google) → `POST /auth/sync` creates
   the local `users` row → `ProtectedRoute` renders after sync. They add emergency
   contacts (≥1 required) and enable location in the setup panel.
2. **Crisis**: user taps or long-presses the SOS button. Zero feedback. `POST /alerts/trigger`
   creates the alert; a 12s WebSocket loop starts streaming fixes; BullMQ fires an SMS +
   email to every contact with the tracking URL. Delivery rows track each attempt.
3. **Contact response**: contact opens the link → live Leaflet map + status pill →
   taps "I'm aware" → alert becomes `acknowledged` (logged, `actor: contact`). The owner's
   UI reflects it via polling/WebSocket.
4. **Resolution**: owner taps "Resolve alert" → `resolved`, `resolvedAt` set, streaming
   stops, tracking link freezes. Activity logs record the whole chain.
5. **Monitoring**: admin sees the alert in the dashboard with timestamps, delivery
   status and aggregates.

---

## 12. Files worth knowing

**API (`apps/api/src/`)**
- `auth/` — sync/me + Firebase Admin JWT verification.
- `users/` — profile + `resolveLocalUserId` bridge.
- `contacts/` — contact CRUD + dedupe + cache.
- `alerts/` — trigger, location, status; `alerts.gateway.ts` (Socket.IO).
- `tracking/` — public tokenized view/acknowledge.
- `notifications/` — BullMQ queue, worker, Twilio/SendGrid providers.
- `admin/` — cross-user table + KPIs.
- `redis/`, `cache/`, `common/guards` — infra and guards.

**Web (`apps/web/src/`)**
- `lib/` — `auth.tsx` (provider + sync), `auth-errors.ts` (friendly messages),
  `apiClient.ts` (axios + auth header), `alerts.ts`/`contacts.ts`/`tracking.ts`/`admin.ts`
  (TanStack Query hooks), `alertSocket.ts` (Socket.IO client), `firebase.ts`, `useGeolocation.ts`.
- `components/` — `SosButton`, `SosPanel`, `LiveMap`, `ProtectedRoute`, `AdminRoute`.
- `pages/` — `HomePage`, `ContactsPage`, `ProfilePage`, `LoginPage`, `TrackAlertPage`, `admin/AdminDashboard`.

---

## 13. Known gaps / notes

- `NOTIFICATIONS_DRY_RUN=true` by default — real SMS/email need Twilio + SendGrid creds.
- Two DBs in Neon (`neondb` used, `bsafe` duplicate) — `bsafe` can be dropped.
- Firebase **Authorized domains** must include the deployed web origin
  (`bsafe-zeta.vercel.app`) for Google popup sign-in.
- Location accuracy depends on device; the app degrades gracefully to last-known.
- No automated tests (out of scope); acceptance was verified manually per phase.