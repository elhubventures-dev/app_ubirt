# UBIRT Mobile (Capacitor)

This project supports iOS/Android with Capacitor.

## 1) Install and sync

```bash
npm install
npm run build:mobile
```

Useful scripts:

- `npm run cap:sync`
- `npm run cap:android`
- `npm run cap:ios`

## 2) OAuth deep link setup (Supabase)

Add this redirect URL in Supabase Auth URL configuration:

- `com.elhubventures.ubirt://login`

Keep your website redirects too:

- `http://localhost:5173/**`
- `https://app.ubirtai.site/**`

Native OAuth flow is handled in:

- `src/hooks/useNativeAuth.js`
- `src/lib/AuthContext.jsx`
- `src/lib/platform.js`

## 3) Voice messages (microphone)

Voice recording in chat uses `@mozartec/capacitor-microphone` on native Android/iOS.

Android `AndroidManifest.xml` must include:

- `RECORD_AUDIO`
- `MODIFY_AUDIO_SETTINGS`

iOS `Info.plist` must include `NSMicrophoneUsageDescription` (already set).

`capacitor.config.json` enables `CapacitorHttp` so native `fetch()` calls reach `https://app.ubirtai.site/api/*` without browser CORS blocks.

After pulling changes:

```bash
npm run build:mobile
npm run cap:android
```

Rebuild/install the app on your phone. The first mic tap should show the system permission prompt.

## 4) Native camera

Native camera capture is implemented in:

- `src/lib/nativeCamera.js`
- `src/pages/Camera.jsx`

On device, the camera page uses Capacitor Camera (photo capture and gallery pick).
On web, it uses a file picker for JPG/PNG images (same upload policy as `/upload`).

## 5) Push notifications

Client registration lives in:

- `src/hooks/usePushNotifications.js`

Server sender endpoint:

- `api/push/send.js`

Also run migration `supabase/migrations/006_push_delivery_tokens.sql`.

### Push setup checklist

Complete these in order before testing on a real phone.

#### Step 0 — Database + app settings

1. Run `supabase/migrations/006_push_delivery_tokens.sql` in Supabase SQL Editor.
2. On the device, open **Settings → Push notifications** and keep it enabled.
3. Sign in on the native app so `usePushNotifications` can register a token.

#### Step 1 — Vercel server env (required for delivery)

Set on Vercel (Production + Preview) and in `.env.local` for `npm run dev:api`:

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Load recipient tokens from `push_tokens` |
| `SUPABASE_URL` | Same project URL as the app |
| `FIREBASE_PROJECT_ID` | Android FCM v1 |
| `FIREBASE_CLIENT_EMAIL` | Android FCM v1 |
| `FIREBASE_PRIVATE_KEY` | Android FCM v1 service account key |
| `APNS_TEAM_ID` | iOS push |
| `APNS_KEY_ID` | iOS push |
| `APNS_BUNDLE_ID` | `com.elhubventures.ubirt` |
| `APNS_PRIVATE_KEY` | Contents of Apple `.p8` key |
| `APNS_USE_SANDBOX` | `true` for Xcode debug builds, `false` for TestFlight / App Store |

Redeploy Vercel after saving env vars.

#### Step 2 — Verify token registration

1. Install the app on a phone and sign in.
2. In Supabase **Table Editor → `push_tokens`**, confirm a row appears for your user:
   - Android: `provider = fcm`, `platform = android`
   - iOS: `provider = apns`, `platform = ios`

If no row appears, check device notification permission and Xcode/Android logcat for `registrationError`.

#### Step 3 — Send a test push

Trigger any in-app event that notifies you (like, comment, follow, or DM from another account). The app calls `POST /api/push/send` after creating the in-app notification.

Or call the API manually (replace `USER_ID`):

```bash
curl -X POST https://app.ubirtai.site/api/push/send \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","title":"UBIRT test","body":"Push delivery check","type":"system"}'
```

Expected: `{ "sent": true, ... }`. If `{ "sent": false, "reason": "no_tokens" }`, the device never registered.

### Firebase (Android FCM) — project `ubirtai`

The Firebase **web config snippet** (apiKey, appId, measurementId) is for browser SDKs. UBIRT server push uses **FCM HTTP v1** with a **service account**, not that snippet.

#### A) Server env (Vercel + `.env.local`)

1. [Firebase Console](https://console.firebase.google.com/) → project **ubirtai**
2. **Project settings** → **Service accounts** → **Generate new private key**
3. Open the downloaded JSON and set:

| Env var | JSON field |
|---------|------------|
| `FIREBASE_PROJECT_ID` | `project_id` → `ubirtai` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` (keep `\n` line breaks) |

Also required:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)

#### B) Android native app (`google-services.json`)

1. Firebase Console → **Project settings** → **Your apps**
2. Add Android app if missing:
   - Package name: `com.elhubventures.ubirt`
3. Download `google-services.json`
4. Place it at:

```
android/app/google-services.json
```

5. Rebuild:

```bash
npm run build:mobile
npm run cap:android
```

The Gradle build auto-applies the Google Services plugin when that file exists.

#### C) iOS (APNs token auth)

1. [Apple Developer](https://developer.apple.com/account/resources/authkeys/list) → **Keys** → create an APNs key → download `.p8` (one-time).
2. Note your **Team ID** (top-right of developer portal) and the key’s **Key ID**.
3. Set in Vercel / `.env.local`:
   - `APNS_TEAM_ID` — Apple Developer Team ID
   - `APNS_KEY_ID` — APNs Auth Key ID
   - `APNS_BUNDLE_ID` — `com.elhubventures.ubirt`
   - `APNS_PRIVATE_KEY` — contents of your `.p8` key (use `\n` for newlines in Vercel)
   - `APNS_USE_SANDBOX` — `true` for Xcode debug builds, `false` for TestFlight / App Store

4. Open Xcode: `npm run cap:ios`
5. Select the **App** target → **Signing & Capabilities** → **+ Capability** → **Push Notifications**
6. Entitlements are already wired in the repo:
   - Debug builds → `App/App.entitlements` (`aps-environment: development`)
   - Release builds → `App/AppRelease.entitlements` (`aps-environment: production`)
7. Match server sandbox flag to build type:
   - Xcode **Run** on device → `APNS_USE_SANDBOX=true`
   - TestFlight / App Store → `APNS_USE_SANDBOX=false`

#### D) Web / browser (no system push)

Browser and PWA users do **not** register push tokens. While the tab is open, notifications arrive via Supabase realtime (`useRealtimeNotifications`) with in-app toasts and sounds.

System push (FCM / APNs) is **native mobile only** — Android and iOS Capacitor builds.

### How push is triggered

When a user likes, comments, or gets followed, the app:

1. Creates an in-app notification via Supabase `create_notification`
2. Calls `POST /api/push/send` with the recipient user ID
3. Server fans out to all tokens in `push_tokens` (FCM for Android, APNs for iOS)

## 6) Native share

Post sharing uses `@capacitor/share` on Android and iOS (system share sheet). On web, the component falls back to the Web Share API, then copy-link.

- Helper: `src/lib/nativeShare.js`
- UI: `src/components/feed/ShareSheet.jsx`
- Share links use `VITE_APP_URL` so native builds point to your public site (e.g. `https://app.ubirtai.site/feed?post=...`), not `capacitor://localhost`.

No extra native permissions are required for the Share plugin.

## 7) Native platform files

Configured:

- Android deep link + permissions: `android/app/src/main/AndroidManifest.xml`
- iOS URL scheme + camera/photo usage strings: `ios/App/App/Info.plist`
- iOS push entitlements: `ios/App/App/App.entitlements` (debug), `ios/App/App/AppRelease.entitlements` (release)

Note: you must still enable the **Push Notifications** capability once in Xcode (Signing & Capabilities).
