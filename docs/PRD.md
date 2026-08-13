# Product Requirements Document — bsafe

**Silent SOS Emergency Web App**
Collaborating organization: Unified Mentor · Reference product: bSafe (Personal Safety App)

---

## 1. Overview

bsafe is a web-based personal safety platform that lets a user send an instant, non-verbal emergency alert with a single action. It is built for situations where calling or speaking is unsafe or impossible — the alert discreetly notifies pre-configured trusted contacts along with the user's live location, and tracks the alert until it is resolved.

## 2. Problem Statement

In emergencies such as harassment, stalking, domestic abuse, medical distress, or public safety threats:

- Victims may be unable to make phone calls.
- Speaking can escalate danger.
- Panic reduces the ability to explain a location clearly.
- Response time is often delayed.
- Existing emergency systems rely heavily on verbal communication, which is not always feasible.

## 3. Objectives

**Primary**

- Enable one-click silent emergency alerts.
- Provide real-time location sharing.
- Reduce response time in critical situations.
- Improve personal safety in public and private spaces.

**Secondary**

- Offer a discreet alternative to emergency calls.
- Enable trusted-contact based safety networks.
- Provide reliable emergency data for responders.
- Support scalable deployment for cities and campuses.

## 4. Scope

**In Scope (Phase 1)**

- Web-based emergency alert system.
- One-click / long-press SOS trigger.
- Real-time location sharing.
- Emergency contact notifications (SMS, email, in-app).
- Alert status tracking (sent → acknowledged → resolved).
- Optional admin/monitoring dashboard.

**Out of Scope (Phase 1)**

- Native mobile applications.
- Automated police/911 integration.
- AI-based threat detection.
- Automated test suites (explicitly deferred for this build cycle).

## 5. Functional Requirements

| Area                          | Requirement                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Silent SOS Trigger            | One-click or long-press activation; no sound or visible confirmation on the user's device |
| Live Location Sharing         | GPS-based real-time tracking; continuous updates until the alert is resolved              |
| Emergency Contacts            | Pre-configured trusted contacts (max 5); instant notification via SMS / email / in-app    |
| Alert Status Tracking         | States: sent, acknowledged, resolved; time-stamped activity log per alert                 |
| Admin & Monitoring (optional) | View active alerts; basic reporting for response analysis                                 |

## 6. Non-Functional Requirements

- Alert dispatch latency target: **< 2 seconds** from trigger to notification job enqueued.
- High availability (24×7 access).
- Secure data handling and privacy (tokenized, expiring public tracking links; no plaintext secrets in the repo).
- Mobile-responsive UI.
- Reliable geolocation accuracy, with documented fallback when GPS/permission is unavailable.
- Rate-limited API surface (see Section 10) to prevent abuse without blocking genuine emergency use.

## 7. Technology Stack

| Layer                           | Technology                                                                |
| ------------------------------- | ------------------------------------------------------------------------- |
| Frontend                        | React.js (Vite), TypeScript                                               |
| Backend                         | NestJS (Node.js), TypeScript                                              |
| Auth                            | Firebase Authentication                                                   |
| Database                        | PostgreSQL                                                                |
| Caching / rate limiting / queue | Redis (`@nestjs/throttler` + Redis storage, BullMQ for notification jobs) |
| Notifications                   | Twilio (SMS), SendGrid/Nodemailer (email)                                 |
| Realtime                        | WebSockets (Socket.IO via NestJS Gateway)                                 |
| Deployment                      | Vercel/Netlify (frontend), Render/AWS (backend), managed Postgres + Redis |

Full phase-by-phase build plan: see `AGENTS.md`. Full file scaffold and per-route rate limits: see `BACKEND_FILES_AND_ROUTES.md`.

## 8. User Flow (High-Level)

1. User registers and adds emergency contacts.
2. User opens the web app (location permission requested during onboarding, not at crisis time).
3. Emergency occurs.
4. User triggers Silent SOS (tap or long-press) — device stays silent, no visible confirmation.
5. Location and alert are sent to trusted contacts via a tokenized tracking link.
6. Contacts view live location, acknowledge, and the alert is tracked until resolved.

## 9. Data Model

See `docs/er-diagram.png` for the full entity-relationship diagram. Core entities:

- **users** — account record, linked to Firebase via `firebase_uid`.
- **emergency_contacts** — trusted contacts per user (max 5).
- **alerts** — one row per SOS trigger; holds status, timestamps, and a tokenized tracking link.
- **alert_locations** — time-series of GPS points per alert (not a single point — supports movement history).
- **activity_logs** — timestamped audit trail of every state change on an alert.
- **notification_deliveries** — per-contact, per-channel delivery status (queued/sent/failed), so "sent" is never conflated with "delivered."

## 10. API & Rate Limiting Summary

All backend routes are individually rate-limited via Redis-backed `@nestjs/throttler`; the SOS trigger route is deliberately kept permissive (5/min) to avoid blocking a real emergency, while public tracking-link routes are limited per-IP since they are unauthenticated. Full route table: `BACKEND_FILES_AND_ROUTES.md`, Section 3.

## 11. Key Performance Indicators

- Average alert delivery time (trigger → contact notified).
- Number of successful alerts sent.
- Response acknowledgment rate.
- System uptime.
- User safety satisfaction score.

## 12. Assumptions & Constraints

**Assumptions**

- Users pre-configure emergency contacts before an emergency occurs.
- Internet connectivity is available at the time of trigger.
- Location services are enabled on the user's device.

**Constraints**

- Web-only access in Phase 1.
- Dependence on device/browser GPS accuracy, including known limitations of background-tab geolocation.
- No direct emergency-service integration in this phase.
- No automated test coverage in this build cycle — acceptance is verified manually per phase.

## 13. Deliverables

- Fully functional web application (React frontend + NestJS backend).
- Emergency alert dashboard (admin/monitoring).
- This PRD and accompanying technical documentation (`AGENTS.md`, `BACKEND_FILES_AND_ROUTES.md`, `er-diagram.png`).
- Deployment-ready system with production Postgres and Redis.

## 14. Expected Impact

- Faster emergency response.
- Improved safety for vulnerable users.
- Reduced risk escalation in unsafe situations.
- Increased confidence in personal safety tools.

## 15. Future Enhancements

- Native mobile app (Android / iOS).
- Offline SMS-based SOS fallback.
- Integration with police & emergency services.
- Wearable device support.
- AI-based risk detection.
