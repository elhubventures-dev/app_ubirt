# UBIRT — accounts & environment checklist

Use this list so nothing is missed. Match each row to a variable in `.env.local` (and Vercel production env).

## Required for production app

| Service | Sign up | Env variables | Purpose |
|---------|---------|---------------|---------|
| **Supabase** | [supabase.com](https://supabase.com) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Auth, database, storage, realtime |

Run all SQL migrations in order in the Supabase SQL Editor: `001` → `022`. See [Supabase migrations](#supabase-migrations) below.

| **GitHub** | [github.com](https://github.com) | — | Source code |
| **Vercel** | [vercel.com](https://vercel.com) | (paste all env vars from `.env.local`) | Host SPA + `/api/*` serverless |

## Strongly recommended

| Service | Sign up | Env variables | Purpose |
|---------|---------|---------------|---------|
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | `OPENAI_API_KEY`, `OPENAI_MODEL` | Real AI chat (server-side) |
| **Resend** | [resend.com](https://resend.com) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` | Transactional email |

### Resend + Supabase Auth (password reset / confirm)

In Supabase: **Authentication → SMTP Settings**

| Field | Value |
|-------|--------|
| Host | `smtp.resend.com` |
| Port | `465` (SSL) or `587` (TLS) |
| User | `resend` |
| Password | Your `RESEND_API_KEY` |
| Sender email | Your verified `RESEND_FROM_EMAIL` |

Also set **Authentication → URL Configuration** site URL to your `VITE_APP_URL`.

### Google sign-in (OAuth)

No extra env vars in the app — configure in Supabase + Google Cloud.

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **Create OAuth client ID** (Web application).
2. **Authorized redirect URI** (from Supabase **Authentication → Providers → Google**):
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Paste **Client ID** and **Client Secret** into Supabase Google provider → Enable.
4. Supabase **URL Configuration**:
   - Site URL: `http://localhost:5173` (dev) or production URL
   - Redirect URLs: `http://localhost:5173/**`, `https://your-domain.com/**`
5. Set `VITE_APP_URL` in `.env.local` to match (used after Google redirect).

The login page **Continue with Google** button uses `signInWithOAuth` and creates a profile from OAuth metadata.

### Apple sign-in (OAuth) — optional / hidden in UI for now

Apple Sign In is supported in code (`signInWithApple`) but the login button is currently hidden. Enable when you need it for App Store review (required if you offer other social login).

1. [Apple Developer](https://developer.apple.com/) → Certificates, Identifiers & Profiles → **Services ID** for Sign in with Apple.
2. Configure redirect URL from Supabase **Authentication → Providers → Apple** (same pattern as Google callback).
3. Paste **Services ID**, **Team ID**, **Key ID**, and private key into Supabase Apple provider → Enable.
4. Add the same redirect URLs in Supabase **URL Configuration** as Google.

Native iOS/Android OAuth uses deep-link callback `com.elhubventures.ubirt://login` (see `docs/MOBILE.md`).

### Payments (wallet coin purchases)

The wallet supports multiple gateways. Set `VITE_PAYMENT_GATEWAY` to choose the active provider (`fincra` or `paystack`).

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_PAYMENT_GATEWAY` | Browser | Active gateway: `fincra` (default) or `paystack` |
| `VITE_PAYMENT_CURRENCY` | Browser | Checkout currency, e.g. `NGN`, `GHS`, `KES` |
| `PAYMENT_GATEWAY` | Server | Should match `VITE_PAYMENT_GATEWAY` for `/api/payments/checkout` |

#### Fincra (default)

| Variable | Where | Purpose |
|----------|--------|---------|
| `FINCRA_API_KEY` | Server only | Secret API key for checkout + verify |
| `FINCRA_PUBLIC_KEY` | Server only | Public key header for checkout |
| `FINCRA_BUSINESS_ID` | Server only | Optional; used when verifying payments |
| `FINCRA_WEBHOOK_SECRET` | Server only | Webhook HMAC validation at `POST /api/webhooks/fincra` |
| `FINCRA_API_BASE_URL` | Server only | `https://sandboxapi.fincra.com` (test) or `https://api.fincra.com` (live) |

1. Create a merchant account at [Fincra](https://app.fincra.com/)
2. **Settings → API keys** — copy secret + public keys
3. **Settings → Portal Settings → Secret keys** — copy webhook secret
4. Add webhook URL: `https://your-domain.com/api/webhooks/fincra` (event: `charge.successful`)
5. Set env vars above and redeploy. Test in sandbox first.

Used by `src/pages/Wallet.jsx`, `api/payments/checkout.js`, and `api/webhooks/fincra.js`.  
Docs: [Checkout Redirect](https://docs.fincra.com/docs/checkout-redirect).

#### Paystack (optional)

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_PAYSTACK_PUBLIC_KEY` | Browser | Paystack inline checkout on `/wallet` |
| `PAYSTACK_SECRET_KEY` | Server only | Webhook signature at `POST /api/webhooks/paystack` |

1. [Paystack Dashboard](https://dashboard.paystack.com/) → **Settings → API Keys & Webhooks**
2. Set `VITE_PAYMENT_GATEWAY=paystack`
3. Copy keys and add webhook URL: `https://your-domain.com/api/webhooks/paystack` (`charge.success`)

Used by `src/pages/Wallet.jsx` and `api/webhooks/paystack.js`.

### Error monitoring & analytics (optional)

Set env vars and redeploy — the app auto-initializes when keys are present:

| Service | Env | What it does |
|---------|-----|----------------|
| **Sentry** | `VITE_SENTRY_DSN` | Captures React errors via `ErrorBoundary` + `@sentry/react` |
| **PostHog** | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | Page views, user identify on login, sign-out reset |

Implementation: `src/lib/monitoring.js`, `src/components/PageTracker.jsx`.

## Optional (by feature)

| Service | Env variables | When you need it |
|---------|-----------------|------------------|
| **Mux** | `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` | Adaptive video streaming |
| **Fincra / Paystack** | See [Payments](#payments-wallet-coin-purchases) | Wallet coin purchases |
| **Sentry** | `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Error tracking |
| **PostHog** | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | Product analytics |
| **Custom domain** | — | Brand URL on Vercel |

## Server-only vs browser-safe

| Prefix | Safe in browser? | Examples |
|--------|------------------|----------|
| `VITE_` | Yes (bundled into client) | Supabase anon key, app URL, Paystack public key |
| No prefix | **No** — server / Vercel only | OpenAI, Resend, Mux, Paystack secret, service role |

Never put `OPENAI_API_KEY`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `MUX_TOKEN_SECRET` in a `VITE_` variable.

## Supabase extra key

| Variable | Where |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |

Use only in serverless functions (bypasses RLS). Required for push delivery, account deletion, and payment webhook coin credit.

## Supabase migrations

Run every file in `supabase/migrations/` in numeric order in the **SQL Editor** (or via Supabase CLI). Each migration is idempotent where possible (`if not exists`, `drop policy if exists`).

| # | File | Purpose |
|---|------|---------|
| 001 | `001_initial_schema.sql` | Core tables: profiles, posts, messaging, uploads, notifications, AI |
| 002 | `002_profiles_auth_fix.sql` | Profile insert policy + signup trigger fix |
| 003 | `003_analytics_gamification.sql` | Views, XP, follows, achievements |
| 004 | `004_wallet_mux_push_notifications.sql` | Coins, wallet ledger, Mux fields, push tokens, notifications |
| 005 | `005_achievement_unlock.sql` | Badge unlock RPC |
| 006 | `006_push_delivery_tokens.sql` | Multi-device push token registry (FCM + APNs) |
| 007 | `007_post_engagement_counts.sql` | Like/comment count triggers |
| 008 | `008_posts_delete_policy.sql` | Authors can delete own feed posts |
| 009 | `009_direct_conversations.sql` | `create_direct_conversation` RPC for DMs |
| 010 | `010_profile_fields.sql` | Bio, phone, website, location on profiles |
| 011 | `011_gift_transfers.sql` | Gift sends with 80/20 creator/platform split |
| 012 | `012_signup_bonus_coins.sql` | New users start with 100 coins |
| 013 | `013_fix_conversation_members_rls.sql` | **Critical** — fixes DM RLS recursion |
| 014 | `014_profile_cover.sql` | Profile `cover_url` |
| 015 | `015_realtime_messages.sql` | Supabase Realtime on `messages` |
| 016 | `016_profile_last_seen.sql` | `last_seen_at` for presence |
| 017 | `017_notification_links.sql` | Notification actor/post/conversation links + `create_notification` RPC |
| 018 | `018_conversation_unread.sql` | `last_read_at` + unread message counts |
| 019 | `019_message_voice.sql` | Voice message `media_url` / `media_type` |
| 020 | `020_messages_delete_policy.sql` | Message delete policy (superseded by 022) |
| 021 | `021_message_media_duration.sql` | Voice message duration metadata |
| 022 | `022_message_hides.sql` | Delete-for-me hides + sender delete-for-everyone |
| 023 | `023_comments_delete_policy.sql` | Users delete own comments + comment count decrement |
| 024 | `024_payment_gateways.sql` | `gateway` column on wallet transactions (Fincra, Paystack) |

**Minimum for current app features:** through `024`. Skipping `013` breaks DMs; skipping `015`–`022` degrades live chat, voice, deletes, and notification deep links.
