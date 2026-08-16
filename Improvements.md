# bSafe — Improvement Instructions

Status: **done 2026-08-16** — Tasks 1, 2, 3, 5 implemented; Task 4 intentionally skipped (note below). Each task lists the file(s) involved, the problem, and the expected fix. Run `npm run lint` and `npm run typecheck` in both workspaces after each task before moving to the next.

---

## 1. Make SOS trigger non-blocking on notification dispatch (High priority)

**Files:** `apps/api/src/alerts/alerts.service.ts`, `apps/api/src/notifications/notifications.service.ts`

**Problem:** `AlertsService.create()` awaits `notifications.enqueueForAlert()` before returning, and `enqueueForAlert()` writes one `notificationDelivery` row and pushes one BullMQ job **sequentially per contact per channel** (a `for` loop with `await` inside). For 5 contacts × 2 channels, that's up to 10 sequential DB round trips before the person who just triggered a silent SOS gets a response. This is the single most safety-critical latency path in the app and it should not block on this.

**Fix (done 2026-08-16):**
- `enqueueForAlert` builds the per-contact-per-channel work as `Promise.all(...)` tasks (parallel DB insert + queue add), so 5 contacts × 2 channels no longer run 10 sequential round trips.
- `AlertsService.create()` fires `enqueueForAlert` without awaiting (`void ... .catch(...)` → logged, not swallowed), so the SOS trigger returns immediately.
- Error handling: a failed enqueue logs via `Logger` and does not fail the trigger. Verified: lint + typecheck + build clean (fixing a TS narrowing regression from the closure refactor).

---

## 2. Add geo bounds validation on alert/location DTOs (Medium priority)

**Files:** `apps/api/src/alerts/dto/trigger-alert.dto.ts`, `apps/api/src/alerts/dto/update-location.dto.ts`

**Problem:** `latitude`/`longitude` fields accept any number. Nothing stops an out-of-range or garbage value (e.g. `9999`) from being persisted and shown on a contact's live map.

**Fix (done 2026-08-16):**
- `@IsLatitude()` / `@IsLongitude()` were already present on both DTOs; added the missing accuracy upper bound `@Max(50000)` (with the existing `@Min(0)`) on `TriggerAlertDto.accuracy` and `UpdateLocationDto.accuracy`.
- Confirmed `main.ts` global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` enforces them.

---

## 3. Harden `.env` hygiene (Low priority, do anyway)

**Files:** `.gitignore`, `apps/api/.env.example`, `apps/web/.env.example`, packaging/zip scripts if any

**Problem:** Real `.env` files (even with dummy values right now) are present in project archives/zips that get shared around. One day a real value will end up in a shared zip by habit.

**Fix (done 2026-08-16):**
- Verified `.gitignore` actually excludes both real `.env` files (`git check-ignore` passes); **removed** the dangerous `!.env.production` negation so no production env file can ever be tracked by habit.
- Added `scripts/check-env-secrets.sh` (staged-files or `--all` scan that refuses any real dotenv) + `scripts/package-for-review.sh` (zips the repo shipping only `.env.example`).
- Wired as `npm run check:secrets` and `npm run package:review`; installed a pre-commit hook symlink (`scripts/pre-commit.sh`) that rejects real `.env` files at commit time. Verified: hook runs, zip contains only `.env.example`.

---

## 4. Make WebSocket location throttling scale-safe (Low priority)

**File:** `apps/api/src/alerts/alerts.gateway.ts`

**Problem:** `lastLocationAt` is an in-memory `Map<socketId, timestamp>` on the gateway instance. This works fine on a single Render instance but silently stops enforcing the 5s throttle correctly if the API ever runs more than one instance (no sticky-session guarantee) or the map isn't cleaned up correctly across long-lived connections.

**Status: skipped (documented known limitation) 2026-08-16.** The app runs on a single Render instance and Socket.IO itself holds per-instance rooms, so horizontal scaling would need sticky sessions regardless. The in-memory throttle is correct today. Noted as a limitation in `alerts.gateway.ts`; move to Redis keyed by `userId` before any multi-instance deploy.

---

## 5. Frontend + schema review (audited 2026-08-16)

**Files:** `apps/web/src/components/SosButton.tsx`, `apps/web/src/hooks/useGeolocation.ts`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/*`

**Problem:** These haven't been reviewed yet. Before calling the app "hardened," check:

**Fix / review checklist (done 2026-08-16):**
- `SosButton.tsx`: **fixed a double-trigger bug** — `onKeyDown` fired `onTrigger('tap')` on Enter/Space while the browser also synthesizes `click`, creating two alerts per keypress. Removed the keydown handler (native button activation covers keyboard) and added a 350ms `firing` ref latch so overlapping pointer/click/keyboard events fire at most one trigger. Long-press→click suppression (`suppressTap`) retained. Confirm still silent: yes — dims only, no sound/modal/animation.
- `useGeolocation.ts`: confirmed `watchPosition` errors degrade gracefully — permission denied → `denied`, GPS unavailable/timeout → `unavailable`, and the last-known position is retained so an SOS can still fire with it (or with no location).
- `schema.prisma` / migrations: cascades are sane (contacts/alerts/locations/activity/deliveries cascade from their owners; `lastLocationId` SetNull is safe). Dedup **is** DB-enforced (`@@unique([userId, phone])`, `@@unique([userId, email])`). **Added** the missing DB-level 5-contact cap via Postgres trigger `trg_emergency_contacts_limit` (migration `20260816000000_contact_limit_trigger`, applied to dev DB) — app-level check in `contacts.service.ts` remains the primary gate.

---

## Suggested order of work

All tasks complete as of 2026-08-16 (task 4 deliberately skipped — no horizontal scaling planned).