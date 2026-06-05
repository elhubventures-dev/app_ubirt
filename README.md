# UBIRT

React + Vite social/creator web app with optional **Supabase** backend and **Vercel** deployment.

## Quick start (mock mode — no accounts)

```bash
npm install
npm run dev
```

Uses in-browser mock data. No login required.

## Accounts & env vars

**Full checklist:** [docs/ACCOUNTS.md](docs/ACCOUNTS.md)  
**Mobile setup:** [docs/MOBILE.md](docs/MOBILE.md)  
**Template to fill in:** [`.env.local`](.env.local) (copy from [`.env.example`](.env.example))

| Service | Required? | Env variables |
|---------|-----------|---------------|
| [Supabase](https://supabase.com) | Yes (live mode) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| [GitHub](https://github.com) | Yes (deploy) | — |
| [Vercel](https://vercel.com) | Yes (deploy) | all vars from `.env.local` |
| [OpenAI](https://platform.openai.com) | Recommended | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| [Resend](https://resend.com) | Recommended | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` |
| [Mux](https://mux.com) | Optional | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` |
| [Paystack](https://paystack.com) | For wallet purchases | `VITE_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY` |
| [Sentry](https://sentry.io) | Optional | `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |
| [PostHog](https://posthog.com) | Optional | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` |

Also set `VITE_APP_URL` (local or production URL) and optionally `SUPABASE_SERVICE_ROLE_KEY` for admin server routes.

## Production stack (steps 1–7)

| Step | What | Accounts |
|------|------|----------|
| 1 | Auth + database | Supabase |
| 2 | Live API | Supabase |
| 3 | Deploy | Vercel + GitHub |
| 4 | File storage | Supabase Storage |
| 5 | AI chat | OpenAI |
| 6 | Realtime chat | Supabase Realtime |
| 7 | Video streaming | Mux (optional) |
| — | Email | Resend (+ Supabase SMTP for auth emails) |

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the full script:
   `supabase/migrations/001_initial_schema.sql`
3. Under **Authentication → Providers**, enable Email and optionally **Google** (see [docs/ACCOUNTS.md](docs/ACCOUNTS.md#google-sign-in-oauth)).
4. Under **Authentication → URL Configuration**, set:
   - **Site URL:** `http://localhost:5173` (or your production URL)
   - **Redirect URLs:** `http://localhost:5173/login`, `http://localhost:5173/**`
5. Run `supabase/migrations/002_profiles_auth_fix.sql` in the SQL Editor (profile insert policy + signup fix).
6. Run `supabase/migrations/003_analytics_gamification.sql` (views, XP, follows, achievements).
7. Run `supabase/migrations/004_wallet_mux_push_notifications.sql` (coins, Paystack ledger, push tokens, Mux on posts, live notifications).
8. Run `supabase/migrations/005_achievement_unlock.sql` (badge unlock RPC).
9. Run `supabase/migrations/006_push_delivery_tokens.sql` (multi-device push token registry for FCM v1 + APNs).
10. Run migrations `007` through `025` in order — see [docs/ACCOUNTS.md](docs/ACCOUNTS.md#supabase-migrations) for the full list (engagement counts, DMs, gifts, voice messages, notification links, unread badges, message hides, comment delete, payment gateways, dual wallet).
11. Copy **Project URL** and **anon public key** from **Settings → API**.

## 2. Local live mode

Copy and fill in `.env.local` (see `.env.example` for every variable):

```bash
cp .env.example .env.local
# Edit .env.local — at minimum Supabase URL + anon key
```

```bash
npm run dev
```

Sign up at `/login`, then use the app with real data.

## 3. Deploy on Vercel

1. Push the repo to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Set environment variables:

Copy **all** keys from `.env.example` into Vercel → Project → Settings → Environment Variables. See [docs/ACCOUNTS.md](docs/ACCOUNTS.md).

4. Deploy. SPA routing is configured in `vercel.json`.

**Local API routes (AI, Mux, payment webhooks):** use Vercel’s dev server so `/api/*` works:

```bash
npm run dev:api
```

This runs `vercel dev`, which serves the Vite app **and** serverless routes under `api/`. Plain `npm run dev` only starts Vite — AI chat, video ingest, and payment webhooks will **not** work locally without `dev:api`.

Ensure `.env.local` includes server keys (`OPENAI_API_KEY`, `MUX_*`, `FINCRA_*` or `PAYSTACK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) when testing those routes.

## 4. Storage

- Buckets `uploads` and `avatars` are created by the migration.
- Upload page accepts **JPG/PNG images** in live mode → Supabase Storage (Mux video ingest is optional via API).

## 5. AI proxy

- Browser calls `POST /api/ai/chat` (Vercel function in `api/ai/chat.js`).
- `OPENAI_API_KEY` never goes to the client.

## 6. Realtime chat

- Enabled on `messages` table (see migration).
- New messages appear without refresh when using live mode.

## 7. Video pipeline (Mux)

- After upload, the app calls `POST /api/video/ingest` with the public file URL.
- If Mux credentials are set on Vercel, playback uses Mux HLS URLs.
- Without Mux, videos play from Supabase Storage URLs.

## 8. Monitoring (optional)

- **Sentry:** set `VITE_SENTRY_DSN` — errors from `ErrorBoundary` are reported automatically.
- **PostHog:** set `VITE_POSTHOG_KEY` (+ optional `VITE_POSTHOG_HOST`) — page views and user sessions tracked on navigation.

See [docs/ACCOUNTS.md](docs/ACCOUNTS.md#error-monitoring--analytics-optional).

---

## Scripts

```bash
npm run dev      # Vite dev server
npm run build    # Production build
npm run build:mobile # Build + Capacitor sync
npm run cap:sync # Sync native iOS/Android projects
npm run cap:ios  # Open iOS project in Xcode
npm run cap:android # Open Android project in Android Studio
npm run preview  # Preview build
npm run test     # Vitest
```

## UI components

**Active primitives** (used across the app): `Card`, `PrimaryButton`, `SkeletonRow`, `InputField`, `toaster` / `use-toast`.

Other files under `src/components/ui/` are unused shadcn scaffolds kept for future expansion — safe to ignore or replace when needed.

Feed-specific: `src/components/feed/CommentsSheet.jsx` powers the video feed comment drawer.

## Architecture

```
Pages → hooks → dataProvider → mockApi | supabaseApi
                              ↘ Supabase (auth, DB, storage, realtime)
API routes (Vercel) → OpenAI, Resend, Mux
```
