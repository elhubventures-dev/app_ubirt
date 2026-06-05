# UBIRT — accounts & environment checklist

Use this list so nothing is missed. Match each row to a variable in `.env.local` (and Vercel production env).

## Required for production app

| Service | Sign up | Env variables | Purpose |
|---------|---------|---------------|---------|
| **Supabase** | [supabase.com](https://supabase.com) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Auth, database, storage, realtime |

Run all SQL migrations in order in the Supabase SQL Editor: `001` → `002` → `003` → `004`. Migration `004` adds wallet coins, Paystack transactions, push device tokens, Mux columns on posts, and live notification creation.

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

The login page **Continue with Google** / **Continue with Apple** buttons use `signInWithOAuth` and create a profile from OAuth metadata.

### Apple sign-in (OAuth)

Required for iOS App Store if you offer other social login (e.g. Google).

1. [Apple Developer](https://developer.apple.com/) → Certificates, Identifiers & Profiles → **Services ID** for Sign in with Apple.
2. Configure redirect URL from Supabase **Authentication → Providers → Apple** (same pattern as Google callback).
3. Paste **Services ID**, **Team ID**, **Key ID**, and private key into Supabase Apple provider → Enable.
4. Add the same redirect URLs in Supabase **URL Configuration** as Google.

Web flow works like Google; native iOS requires additional Capacitor/deep-link setup.

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
| **Stripe** | `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paid features |
| **Sentry** | `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | Error tracking |
| **PostHog** | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | Product analytics |
| **Custom domain** | — | Brand URL on Vercel |

## Server-only vs browser-safe

| Prefix | Safe in browser? | Examples |
|--------|------------------|----------|
| `VITE_` | Yes (bundled into client) | Supabase anon key, app URL, Stripe publishable |
| No prefix | **No** — server / Vercel only | OpenAI, Resend, Mux, Stripe secret, service role |

Never put `OPENAI_API_KEY`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `MUX_TOKEN_SECRET` in a `VITE_` variable.

## Supabase extra key

| Variable | Where |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |

Use only in serverless functions (bypasses RLS). Not required for basic app usage.
