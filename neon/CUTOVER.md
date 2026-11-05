# Neon cutover & Supabase decommission

## Preconditions

- [ ] Neon project created; `DATABASE_URL` set on Vercel + `.env.local`
- [ ] `npm run neon:port-migrations` run; SQL applied per [DUAL_RUN.md](./DUAL_RUN.md)
- [ ] `/api/platform/health` shows `neon.ok: true` (and Redis/Blob/Clerk/Ably as configured)
- [ ] Clerk app created; webhook `user.created` / `user.updated` → `/api/webhooks/clerk`
- [ ] Ably app created; `ABLY_API_KEY` set
- [ ] Blob token set; `VITE_STORAGE_PROVIDER=blob`
- [ ] Upstash Redis recommended for production rate limits

## Flip flags

```env
VITE_DATA_BACKEND=neon
VITE_AUTH_PROVIDER=clerk
VITE_REALTIME_PROVIDER=ably
VITE_STORAGE_PROVIDER=blob
STORAGE_PROVIDER=blob
```

Redeploy Vercel. Smoke-test: login, feed, upload avatar, send DM, notifications.

## Decommission Supabase

1. Freeze writes on Supabase (maintenance window).
2. Final data export / import into Neon if dual-run was used.
3. Remove `VITE_SUPABASE_*` and `SUPABASE_*` from Vercel env.
4. Delete or pause the Supabase project.
5. Keep this repo’s `supabase/` folder as historical migration source until Neon-only migrations are authoritative.

## Notes

- Nested PostgREST selects (`profiles(*)`) are flattened by the Neon REST shim; expand `server/neonRest.js` / client as you hit gaps.
- RLS is not the trust boundary on Neon — `/api/platform/neon-rest` authenticates via Clerk/Supabase JWT and allowlists tables.
