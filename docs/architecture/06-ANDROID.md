# 06 - Android

Capacitor 8.4.1 wraps the same React build that ships to the web. There is no separate
native UI - `dist/` is copied into the WebView.

## Configuration

`app/capacitor.config.ts`:

```ts
{
  appId: 'org.nithyakarma.app',
  appName: 'Nithyakarma',
  webDir: 'dist'
}
```

> **Renamed 2026-07-18** from `org.nithyakarma.app`, before first publish -
> the last point at which this was possible. The `applicationId` becomes permanent the
> moment the app is published to Play; changing it afterwards means a brand-new listing
> with zero installs and zero reviews.
>
> ### ⚠️ Two external re-registrations are required before the rename works
>
> The rename is complete in the repo but **breaks two Google integrations until these
> are done in their respective consoles**:
>
> 1. **Firebase / FCM.** `android/app/google-services.json` binds the FCM sender to
>    `org.nithyakarma.app` (project `huntersreeni`,
>    `mobilesdk_app_id 1:751164509093:android:2011b1660044bb9d69764c`). Register a new
>    Android app for `org.nithyakarma.app` in the Firebase console, download the fresh
>    `google-services.json`, and replace the file. **Until then, Android push
>    registration fails.** This file cannot be hand-edited - the IDs are issued by
>    Firebase.
> 2. **Google Cloud OAuth.** The Sign-In client is registered against the old package
>    name and its SHA-1. Create a new OAuth client for `org.nithyakarma.app` with the
>    debug and release SHA-1 fingerprints, then add the new redirect URL to the
>    Supabase Auth allow-list. **Until then, "Continue with Google" fails on Android.**

## Version numbering

`android/app/build.gradle` derives `versionCode` arithmetically from `versionName`:

```gradle
versionCode major * 10000 + minor * 100 + patch
versionName appVersionName
```

So `0.15.4` → `1504`. This matters because **Play rejects a re-upload with a duplicate
versionCode**, and the previous hardcoded `1` would have blocked every update after the
first. release-please owns `versionName`; `versionCode` follows automatically.

## Permissions

Only two are declared:

| Permission | Why |
|---|---|
| `INTERNET` | Supabase, FCM, AdMob |
| `POST_NOTIFICATIONS` | Android 13+ runtime notification permission |

**No location, no storage, no contacts.** Keeping this list short is what keeps the Play
Data Safety declaration simple. Adding location for the temple-visit feature would move
the app into a sensitive-permission category and force a re-declaration.

## Security posture

- `android:allowBackup="false"` - blocks `adb backup` extraction of app data (closed
  finding S8)
- `FileProvider` is `exported="false"` with granted URI permissions
- The OAuth deep-link filter uses `autoVerify="false"` since it is a custom scheme, not
  an App Link

## Deep linking

```xml
<data android:scheme="org.nithyakarma.app" android:host="auth-callback" />
```

This must stay **exactly** in sync with `NATIVE_OAUTH_REDIRECT` in
`src/hooks/useAuth.jsx:10`. Google OAuth returns here, `@capacitor/app`'s `appUrlOpen`
listener catches it, and `useAuth` completes the Supabase session from the URL fragment.

Renaming the appId means changing the scheme, the manifest, `useAuth.jsx`, **and**
registering a new Google Cloud OAuth client plus adding the new redirect to the Supabase
Auth allow-list. All four together or Google Sign-In breaks.

## AdMob

```xml
<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
           android:value="ca-app-pub-3940256099942544~3347511713" />
```

> ⚠️ Both this app ID and the interstitial unit in `src/utils/ads.js:6` are **Google test
> IDs**. Shipping them to production serves no real ads and violates AdMob policy.
> Replacing them is the last remaining launch blocker.
>
> The comment in the manifest is accurate and worth heeding: **a missing AdMob app ID
> crashes the app at launch**, so the key must be present even in debug builds.

Ad behaviour (per Intent 0.2): fires after a *verified* save and before the celebration,
capped at one per session, never on a failed save, suppressed when `isAdFree`. Content
rating must be set to **G** with gambling/dating/alcohol categories blocked in the AdMob
console - a sectarian-adjacent app cannot afford a gambling ad beside a sandhya prompt.

## Capacitor plugins

| Plugin | Used for |
|---|---|
| `@capacitor/app` | `appUrlOpen` OAuth deep link |
| `@capacitor/core`, `@capacitor/android` | Runtime |
| `@capacitor/haptics` | Celebration feedback (Intent 2.2) |
| `@capacitor/local-notifications` | On-device scheduled nudges |
| `@capacitor/push-notifications` | FCM registration and delivery |
| `@capacitor/preferences` | Local key-value state |
| `@capacitor/share` | WhatsApp referral share |
| `@capacitor-community/admob` | Interstitials |
| `@capacitor-community/in-app-review` | Milestone review prompt |

## Build and run

```bash
cd app
npm run build          # Vite build into dist/
npx cap sync android   # copy web assets + plugin wiring
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.nithyakarma.app/.MainActivity
```

**Always rebuild and `cap sync` after touching `src/`** - the Android WebView serves the
copied `dist/`, so a source edit alone changes nothing on device.

### Driving the emulator on this machine

There is no display server, so UI automation is done with screenshot-and-tap over adb.
Three things reliably intercept blind taps and must be handled first:

1. The OS notification permission dialog (Android 13+)
2. The driver.js guided tour on first run
3. A live AdMob test interstitial

Seeding `profiles.ad_free_until` into the future removes the third hazard for test runs.

## Related

- Push flow: [07-NOTIFICATIONS.md](07-NOTIFICATIONS.md)
- OAuth handling: [05-FRONTEND.md](05-FRONTEND.md)
