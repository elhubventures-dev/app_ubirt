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

## 3) Native camera

Native camera capture is implemented in:

- `src/lib/nativeCamera.js`
- `src/pages/Camera.jsx`

On device, the camera page uses Capacitor Camera (photo capture and gallery pick).
On web, it continues to use MediaRecorder.

## 4) Push notifications

Client registration lives in:

- `src/hooks/usePushNotifications.js`

Server sender endpoint:

- `api/push/send.js`

Also run migration `supabase/migrations/006_push_delivery_tokens.sql`.

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

Set in Vercel / `.env.local`:

- `APNS_TEAM_ID` — Apple Developer Team ID
- `APNS_KEY_ID` — APNs Auth Key ID
- `APNS_BUNDLE_ID` — `com.elhubventures.ubirt`
- `APNS_PRIVATE_KEY` — contents of your `.p8` key
- `APNS_USE_SANDBOX` — `true` for dev builds, `false` for App Store / TestFlight production

In Xcode: enable **Push Notifications** capability and link `App.entitlements`.

### How push is triggered

When a user likes, comments, or gets followed, the app:

1. Creates an in-app notification via Supabase `create_notification`
2. Calls `POST /api/push/send` with the recipient user ID
3. Server fans out to all tokens in `push_tokens` (FCM for Android, APNs for iOS)

## 5) Native platform files

Configured:

- Android deep link + permissions: `android/app/src/main/AndroidManifest.xml`
- iOS URL scheme + camera/photo usage strings: `ios/App/App/Info.plist`
- iOS push entitlement file: `ios/App/App/App.entitlements`

Note: ensure Xcode target enables Push Notifications capability and references `App.entitlements`.
