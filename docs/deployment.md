# Deployment Runbook — bsafe

Production URLs:

- **Web:** https://bsafe-zeta.vercel.app
- **API:** https://bsafe-api.onrender.com
- **Health check:** https://bsafe-api.onrender.com/api/health → `{"status":"ok","redis":"PONG","time":…}`

## Architecture

| Component            | Host                        | Notes                                                                  |
| -------------------- | --------------------------- | ---------------------------------------------------------------------- |
| `apps/web` (React)   | Vercel                      | Static Vite build; `VITE_API_URL` baked in; `/track/:token` is a client route |
| `apps/api` (NestJS)  | Render (web service)        | Serves HTTP + Socket.IO on :10000; BullMQ worker runs in-process       |
| PostgreSQL           | Neon (`dry-hill-74512166`)  | Pooler URL in `DATABASE_URL`; migrations applied                        |
| Redis                | Upstash                     | `rediss://` TLS; used by throttler storage, cache, BullMQ               |
| Auth                 | Firebase                     | Email/password + phone OTP; server verifies ID tokens via Admin SDK     |
| SMS/Email            | Twilio / SendGrid            | Not enabled in prod yet — `NOTIFICATIONS_DRY_RUN=true`                  |

## Environment variables

See `apps/api/.env.example` and `apps/web/.env.example` for the full list. Every value is set as a secret in the hosting dashboard; nothing is committed to git.

### API (Render dashboard → Environment)

- `NODE_ENV=production`
- `PORT=10000` (Render injects this automatically)
- `DATABASE_URL` — Neon pooled connection string (`sslmode=require`)
- `REDIS_URL` — Upstash `rediss://user:pass@host:6379`
- `CORS_ORIGINS` — comma-separated origins, e.g. `https://bsafe-zeta.vercel.app`
- `WEB_BASE_URL=https://bsafe-zeta.vercel.app`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `ADMIN_EMAILS` — comma-separated emails granted admin
- `NOTIFICATIONS_DRY_RUN=true` — log notifications instead of sending (set `false` once Twilio/SMTP creds are added)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS sender. `TWILIO_PHONE_NUMBER` is a Twilio number in E.164 format (e.g. `+14155238885`); no Messaging Service is required. On a trial account every recipient must also be a Verified Caller ID, otherwise Twilio rejects the send (error 21608).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL` — email sender via Nodemailer over plain SMTP (Gmail: `smtp.gmail.com:587` with an app password; `SMTP_SECURE=true` for port 465).

### Web (Vercel project → Environment)

- `VITE_API_URL=https://bsafe-api.onrender.com`
- `VITE_FIREBASE_*` — Firebase web app config

## Deploying

### API (Render)

Push to `main` → auto-deploy. Build command (set in the dashboard):

```
npm ci && npm install-scripts approve esbuild prisma @prisma/engines @firebase/util protobufjs && npm run build -w @bsafe/api
```

Start command: `npm run start -w @bsafe/api` (runs `node dist/main.js`).

> npm 11 blocks lifecycle scripts by default — `npm install-scripts approve …` must run after `npm ci`, or Prisma engines / esbuild silently break.

### Web (Vercel)

Push to `main` → auto-deploy. Framework auto-detected (Vite); root directory `apps/web`; build `npm run build`; output `dist`.

## Post-deploy verification

```
curl https://bsafe-api.onrender.com/api/health
curl -i -X OPTIONS https://bsafe-api.onrender.com/api/health \
  -H "Origin: https://bsafe-zeta.vercel.app" -H "Access-Control-Request-Method: GET"
curl -s https://bsafe-zeta.vercel.app/ | grep "<title>"
```

Full SOS → notify → resolve walkthrough (manual): sign up / log in on the web app, add ≥1 contact, trigger SOS, confirm the tracking link resolves and locations stream, acknowledge + resolve.

## Operations notes

- **Redis URL parsing** — ioredis only parses a connection URL when it is passed as a string argument. `apps/api/src/redis/redis-config.ts` parses `REDIS_URL` into `host`/`port`/`username`/`password`/`tls` so the spread works with both `new Redis({…})` and BullMQ's `connection` option. Startup logs the sanitized `REDIS_URL` host and the actual dial target.
- **Upstash IP allowlist** — if enabled, it applies database-wide (TCP *and* REST). Render free instances have no static egress IP; allow `0.0.0.0/0` or use the hostname allowlist.
- **Migrations** — run `npm run prisma:migrate -w @bsafe/api` locally against the Neon DB (or `prisma migrate deploy` in CI) before deploying code that expects new columns. Prisma 7 uses `prisma.config.ts` + the driver adapter (`@prisma/adapter-pg`).
- **BullMQ worker** — in-process on the single API instance. Split into a standalone worker container when scaling past one instance.
- **Socket.IO** — single-instance adapter in production; add the Socket.IO Redis adapter + `ws` reverse-proxy support for multi-instance.
- **Uptime monitoring** — `GET /api/health` is pinger-ready; wire an external uptime service (UptimeRobot, etc.) to it. Optional: Sentry for errors.

## Load numbers (Phase 9, local stack, N=30)

- Alert create (dispatch incl. delivery enqueue): **avg 47 ms, p95 83 ms, max 117 ms** (<2 s acceptance met).
- Location update: **avg 13 ms, p95 19 ms, max 22 ms**.

Re-run after any schema/query changes; document fresh numbers here.
