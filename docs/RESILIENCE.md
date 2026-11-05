# UBIRT — database resilience strategy

## Decision (locked)

**Full exit path from Supabase** as the long-term primary backend, because free-tier / single-vendor downtime has been unacceptable for production.

| Store | Role | Status |
|-------|------|--------|
| **Neon** (Postgres) | Single source of truth for app data | Target primary DB |
| **Upstash Redis** | Rate limits, cache, short-lived presence | Companion (use immediately) |
| **Vercel Blob** | Images, voice, uploads | Companion (use immediately) |
| **Clerk** | Auth (replaces Supabase Auth) | Required for Neon cutover |
| **Ably** | Realtime chat / notifications / presence | Required for Neon cutover |

**Not used as primary DBs:** Prisma Postgres, Nile, Turso, MongoDB, Convex, MotherDuck, Mem0.

Do **not** run three Postgres vendors in parallel. One write primary only.

## Runtime modes

Set in env (see `.env.example`):

| Variable | Values | Meaning |
|----------|--------|---------|
| `VITE_DATA_BACKEND` | `supabase` (default) \| `neon` | Which data API the SPA uses |
| `STORAGE_PROVIDER` / `VITE_STORAGE_PROVIDER` | `supabase` (default) \| `blob` | Media upload target |
| `RATE_LIMIT_BACKEND` | `memory` \| `redis` (auto if Upstash configured) | API rate limiting |

During migration, keep Supabase credentials until Neon + Clerk + Ably are verified, then flip `VITE_DATA_BACKEND=neon` and remove Supabase.

## Phases

1. **Redis + Blob** — live alongside Supabase (reduces rate-limit gaps; alternate media path). **Implemented.**
2. **Neon schema** — apply `neon/migrations`, dual-run health checks via `/api/platform/health`. **Implemented** (apply SQL in Neon console). Platform routes are bundled under `/api/platform/[action]` for Vercel Hobby’s 12-function limit.
3. **Clerk + Ably** — auth and realtime without Supabase. **Implemented** (enable via env).
4. **Cutover** — flip env flags per [neon/CUTOVER.md](../neon/CUTOVER.md), then decommission Supabase.

## What shipped in code

| Area | Location |
|------|----------|
| Redis rate limit | `server/rateLimit.js`, `server/redis.js` |
| Blob uploads | `/api/platform/blob-upload`, `src/api/storage.js` |
| Neon client + REST | `server/neon.js`, `/api/platform/neon-rest`, `src/lib/neonDataClient.js` |
| Migrations | `neon/migrations/*`, `npm run neon:port-migrations` |
| Health / dual-run | `/api/platform/health` |
| Clerk auth | `src/lib/PlatformAuthProvider.jsx`, `/api/webhooks/clerk`, `server/clerkAuth.js` |
| Ably realtime | `src/lib/ablyClient.js`, `/api/platform/ably-token`, `/api/platform/realtime-publish` |
| Cutover flags | `src/lib/platformConfig.js`, `.env.example` |
| Hobby limit | Shared code lives in `server/` (outside `api/`) so Vercel does not count helpers as functions |

## Why not “stabilize paid Supabase only”

Paid Supabase is a valid short-term hedge, but this project chose multi-vendor resilience (Neon + Redis + Blob) so auth/DB/storage/realtime are not one outage domain.
