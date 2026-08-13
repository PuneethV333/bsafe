# bsafe — File Scaffold & Backend Route Reference

Companion to `AGENTS.md`. This is the file list an agent should create while vibe-coding this project, and the full backend route table with per-route rate limits. Tests are intentionally excluded — no spec/e2e files listed.

---

## 1. Full File Scaffold

### Root

```
bsafe/
├── AGENTS.md
├── BACKEND_FILES_AND_ROUTES.md
├── PHASE_LOG.md
├── README.md
├── docker-compose.yml          # postgres + redis
├── package.json                 # workspaces root
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── docs/
│   ├── er-diagram.png
│   ├── deployment.md
│   └── PRD.md
├── apps/
│   ├── api/
│   └── web/
└── packages/
    └── shared-types/
        ├── package.json
        └── src/
            ├── user.types.ts
            ├── contact.types.ts
            ├── alert.types.ts
            └── index.ts
```

### `apps/api` (NestJS)

```
apps/api/
├── package.json
├── nest-cli.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── config/
│   │   ├── configuration.ts
│   │   └── validation.schema.ts
│   │
│   ├── common/
│   │   ├── guards/
│   │   │   └── firebase-auth.guard.ts
│   │   ├── decorators/
│   │   │   └── current-user.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── interceptors/
│   │   │   └── logging.interceptor.ts
│   │   └── pipes/
│   │       └── validation.pipe.ts
│   │
│   ├── redis/
│   │   ├── redis.module.ts
│   │   ├── redis.service.ts
│   │   └── cache.service.ts
│   │
│   ├── database/
│   │   ├── data-source.ts
│   │   ├── migrations/
│   │   │   ├── 001_create_users.ts
│   │   │   ├── 002_create_emergency_contacts.ts
│   │   │   ├── 003_create_alerts.ts
│   │   │   ├── 004_create_alert_locations.ts
│   │   │   ├── 005_create_activity_logs.ts
│   │   │   └── 006_create_notification_deliveries.ts
│   │   └── seeds/
│   │       └── seed.ts
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── firebase-admin.provider.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── entities/user.entity.ts
│   │   │   └── dto/update-user.dto.ts
│   │   │
│   │   ├── contacts/
│   │   │   ├── contacts.module.ts
│   │   │   ├── contacts.controller.ts
│   │   │   ├── contacts.service.ts
│   │   │   ├── entities/emergency-contact.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-contact.dto.ts
│   │   │       └── update-contact.dto.ts
│   │   │
│   │   ├── alerts/
│   │   │   ├── alerts.module.ts
│   │   │   ├── alerts.controller.ts
│   │   │   ├── alerts.service.ts
│   │   │   ├── alerts.gateway.ts          # WebSocket gateway for live location
│   │   │   ├── entities/
│   │   │   │   ├── alert.entity.ts
│   │   │   │   ├── alert-location.entity.ts
│   │   │   │   └── activity-log.entity.ts
│   │   │   └── dto/
│   │   │       ├── trigger-alert.dto.ts
│   │   │       ├── update-location.dto.ts
│   │   │       └── update-status.dto.ts
│   │   │
│   │   ├── tracking/
│   │   │   ├── tracking.module.ts
│   │   │   ├── tracking.controller.ts     # public tokenized endpoints
│   │   │   └── tracking.service.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.service.ts
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.processor.ts  # BullMQ worker
│   │   │   ├── entities/notification-delivery.entity.ts
│   │   │   └── providers/
│   │   │       ├── twilio.provider.ts
│   │   │       └── sendgrid.provider.ts
│   │   │
│   │   └── admin/
│   │       ├── admin.module.ts
│   │       ├── admin.controller.ts
│   │       └── admin.service.ts
│   │
│   └── health/
│       └── health.controller.ts
```

### `apps/web` (React + Vite)

```
apps/web/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    │
    ├── firebase/
    │   └── firebase.config.ts
    │
    ├── api/
    │   └── apiClient.ts               # axios instance + Firebase token interceptor
    │
    ├── context/
    │   └── AuthContext.tsx
    │
    ├── routes/
    │   ├── AppRouter.tsx
    │   └── ProtectedRoute.tsx
    │
    ├── hooks/
    │   ├── useGeolocation.ts
    │   ├── useWebSocket.ts
    │   └── useAlertStatus.ts
    │
    ├── services/
    │   ├── auth.service.ts
    │   ├── contacts.service.ts
    │   ├── alerts.service.ts
    │   └── tracking.service.ts
    │
    ├── pages/
    │   ├── Login.tsx
    │   ├── Signup.tsx
    │   ├── Dashboard.tsx
    │   ├── Contacts.tsx
    │   ├── SosTrigger.tsx
    │   ├── AlertTracking.tsx          # public route: /track/:token
    │   └── admin/
    │       └── AdminDashboard.tsx
    │
    └── components/
        ├── SosButton.tsx
        ├── ContactForm.tsx
        ├── ContactList.tsx
        ├── LiveMap.tsx
        └── AlertStatusBadge.tsx
```

---

## 2. Redis Usage Map

| Purpose                                                           | Where                                                                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Rate-limit counters                                               | `@nestjs/throttler` + `nestjs-throttler-storage-redis`, applied per-route (table below)                          |
| Response caching                                                  | `CacheService` — user profile & contacts list, 30–60s TTL, invalidated on write                                  |
| Notification queue                                                | BullMQ (`notifications.processor.ts`), backed by Redis                                                           |
| WebSocket scaling (optional, note for Phase 10 if multi-instance) | Socket.IO Redis adapter, so live-location events reach clients regardless of which API instance holds the socket |

---

## 3. Backend Routes (all, with rate limits)

Rate limits are expressed as `requests / window`, scoped **per authenticated user** unless marked "per IP" (used for public/unauthenticated routes). All limits are defaults — tune after load testing in Phase 9.

### Auth (`/auth`)

| Method | Route        | Auth           | Rate limit        | Purpose                                                   |
| ------ | ------------ | -------------- | ----------------- | --------------------------------------------------------- |
| POST   | `/auth/sync` | Firebase token | 10 / min per IP   | Create/link local `users` row after Firebase signup/login |
| GET    | `/auth/me`   | Firebase token | 30 / min per user | Return current session's user record                      |

### Users (`/users`)

| Method | Route       | Auth     | Rate limit | Purpose        |
| ------ | ----------- | -------- | ---------- | -------------- |
| GET    | `/users/me` | Required | 30 / min   | Get profile    |
| PATCH  | `/users/me` | Required | 10 / min   | Update profile |

### Emergency Contacts (`/contacts`)

| Method | Route           | Auth     | Rate limit | Purpose                                   |
| ------ | --------------- | -------- | ---------- | ----------------------------------------- |
| GET    | `/contacts`     | Required | 30 / min   | List trusted contacts (cached)            |
| POST   | `/contacts`     | Required | 10 / min   | Add a contact (max 5 enforced in service) |
| PATCH  | `/contacts/:id` | Required | 10 / min   | Edit a contact                            |
| DELETE | `/contacts/:id` | Required | 10 / min   | Remove a contact                          |

### Alerts (`/alerts`)

| Method | Route                  | Auth     | Rate limit | Purpose                                                                            |
| ------ | ---------------------- | -------- | ---------- | ---------------------------------------------------------------------------------- |
| POST   | `/alerts/trigger`      | Required | 5 / min    | Fire a silent SOS — deliberately low but not so low it blocks a genuine re-trigger |
| POST   | `/alerts/:id/location` | Required | 60 / min   | REST fallback for location ping if WebSocket drops                                 |
| PATCH  | `/alerts/:id/status`   | Required | 20 / min   | Change status (acknowledged/resolved)                                              |
| GET    | `/alerts/:id`          | Required | 30 / min   | Get single alert detail                                                            |
| GET    | `/alerts`              | Required | 30 / min   | List current user's alert history                                                  |

### Public Tracking (`/tracking`) — tokenized, unauthenticated

| Method | Route                          | Auth         | Rate limit      | Purpose                                  |
| ------ | ------------------------------ | ------------ | --------------- | ---------------------------------------- |
| GET    | `/tracking/:token`             | Token in URL | 20 / min per IP | Contact views live alert location/status |
| POST   | `/tracking/:token/acknowledge` | Token in URL | 10 / min per IP | Contact marks alert acknowledged         |

### Notifications (`/notifications`) — internal/admin use

| Method | Route                            | Auth     | Rate limit | Purpose                                  |
| ------ | -------------------------------- | -------- | ---------- | ---------------------------------------- |
| POST   | `/notifications/:alertId/retry`  | Admin    | 5 / min    | Manually retry failed deliveries         |
| GET    | `/notifications/:alertId/status` | Required | 30 / min   | Delivery status per contact for an alert |

### Admin (`/admin`)

| Method | Route            | Auth  | Rate limit | Purpose                                                       |
| ------ | ---------------- | ----- | ---------- | ------------------------------------------------------------- |
| GET    | `/admin/alerts`  | Admin | 30 / min   | List all alerts across users                                  |
| GET    | `/admin/reports` | Admin | 10 / min   | Aggregated KPI reporting (avg. delivery time, ack rate, etc.) |

### Health (`/health`)

| Method | Route     | Auth | Rate limit      | Purpose                                     |
| ------ | --------- | ---- | --------------- | ------------------------------------------- |
| GET    | `/health` | None | 60 / min per IP | Uptime check for external pinger/monitoring |

### WebSocket Gateway (`alerts.gateway.ts`)

Not REST, so not covered by `@nestjs/throttler` — throttle at the gateway level manually (e.g. reject `updateLocation` events from a socket if received more than once per 5s) to prevent a compromised/malicious client from flooding location updates.

---

## 4. Notes for the Agent

- Every controller route above must carry an explicit `@Throttle({ default: { limit, ttl } })` (or module-level default only where the table says so) — do not leave any route on an unstated global default.
- `/alerts/trigger` and `/tracking/*` are the two most safety-critical rate limits: too strict and a real victim gets blocked; too loose and the endpoint becomes a DoS/abuse vector. Flag this trade-off in `PHASE_LOG.md` if you change the suggested numbers.
- No `*.spec.ts` or `*.e2e-spec.ts` files are listed — testing is out of scope per current instructions.
