# Playsz

**App name (final): Playsz - All In One Player.** Still clear trademark and store uniqueness before any store submit.

Playsz is an offline video player for **Android and iOS**, launching on both platforms together. It is built to beat PLAYit by never interrupting playback, never showing ads, saving only standard file formats (no lock-in), and asking for as few permissions as possible.

Product docs:

- [docs/SPEC.md](docs/SPEC.md) — problem, users, MVP vs v2, stack, monetization, risks
- [docs/STORE_LISTING.md](docs/STORE_LISTING.md) — Play Store and App Store drafts
- [docs/PAYWALL_PLAN.md](docs/PAYWALL_PLAN.md) — free vs Pro, prices, trials, store billing
- [docs/QA_STATUS.md](docs/QA_STATUS.md) — QA checklist mapped to the real repo (not a PASS yet)

Android application id `com.allinone.videoplayer`; iOS bundle identifier `com.samayvashsht.playsz` (com.allinone.videoplayer was taken on Apple) (final).

## No third-party APIs

Hard rule: **no third-party APIs and no paid services or access.** Everything is built in-house. Open-source libraries are allowed.

That means:

- No RevenueCat, no billing backend, no custom account server. Digital goods are sold only through **Google Play Billing** and **Apple StoreKit** (the stores require this) using an open-source on-device library such as expo-iap or react-native-iap when the paywall is implemented. Entitlements are checked on the device.
- No ad networks and no ad SDKs. There are no ads in any tier. Revenue is monthly, yearly, and lifetime purchases only.
- No cloud APIs. AI subtitles and translation, when they ship in v2, run on the device with open-source models (for example whisper.cpp). Private-folder backup is a local encrypted export/import, not cloud sync. Subtitles come from embedded tracks, local files, and manual import — no OpenSubtitles or other catalog APIs. Casting and LAN streaming, when they ship in v2, use open protocols (DLNA/UPnP, SMB) implemented with open-source code, not the Google Cast SDK or other vendor SDKs.
- No analytics or crash-reporting SDKs (no Firebase, Sentry, or similar). Logs stay on the device and are not uploaded.
- No YouTube or social-video downloader (store policy risk), in addition to the API rule.

The stores' own billing and the operating systems themselves are not "third-party APIs" in this rule; they are required platform services. Expo and other MIT/Apache open-source libraries in this repository are allowed.

## Features

### MVP (first store release)

- Local video library (device and SD card): folders, recents, search
- Playback of common formats, with a path to FFmpeg/libVLC so 4K and EAC3/Dolby audio work on real devices
- No ads anywhere
- Resume position, playlists, Bluetooth-safe continuation
- Gestures: swipe to seek, double-tap skip, left-edge brightness (expo-brightness window brightness), right-edge playback volume (`player.volume`; system volume would need a third-party SDK, which is not used)
- Background audio and picture-in-picture / popup player
- Local and embedded subtitles with manual import and per-file sync
- Video-to-M4A export (on-device AAC remux via a local Expo module; capped on the free tier; only successful exports count)
- Play PLAYit/VidMate files where legally and technically possible; no proprietary lock-in of our own
- Private folder with a recovery key and a Pro local encrypted export/import
- Minimal permissions and on-device data deletion
- Optional Pro via Play Billing and StoreKit

The current app implements the library screen (folders, recents, search, paging past 200), the player (expo-video, working brightness and playback-volume gestures, SRT/ASS import), on-device resume, Settings, a paywall wired to expo-iap, real video-to-M4A export (AAC remux), a real private folder in app-private storage, and local AES-GCM encrypted export/import. The production playback engine (FFmpeg/libVLC) is still to be built.

### v2

- On-device AI subtitles and translation (open-source models, e.g. whisper.cpp)
- SMB and DLNA/UPnP streaming implemented with open-source code
- Equalizer / advanced audio, HDR/AV1 tuning
- Further localized UI and store listings

### Excluded

- YouTube or social-video downloaders
- Game hall, coin economy, content feeds
- Any third-party or paid API listed in the section above

## Player and library features (iOS TestFlight build 2 fixes)

Branch `playsz/ios-playback-fixes`. Everything is on-device; no new network calls.

**Fixed**

- **Blank player.** The library resolved a URI with `Asset.getInfo()` and passed it as a route param; the
  player then called `replaceAsync` and never listened for `statusChange`, so any load failure showed a
  black screen with no error. Now the player receives only the asset id, resolves it itself with
  `Asset.getUri()` (SDK 58's replacement for `getAssetInfoAsync().localUri`; on iOS it uses
  `isNetworkAccessAllowed = true` + high-quality delivery, so iCloud-only videos download first, and
  edited/slow-mo videos are exported to a temp file), shows a spinner and an "iCloud" notice, surfaces
  player errors, and retries once by handing the raw `ph://` / `content://` id to expo-video (which
  resolves PhotoKit sandbox access itself). `VideoView` fills the stage with `StyleSheet.absoluteFill`
  and `contentFit="contain"`.
- **Green placeholders.** Rows now show real thumbnails from `expo-video-thumbnails`, generated from the
  resolved URI (never `ph://`), cached on disk in `<cacheDirectory>/thumbnails/` keyed by asset id +
  `modificationTime`, loaded lazily per visible row with at most 3 at a time. iCloud-only videos are
  skipped so the library never downloads whole videos for a thumbnail.
- **Wrong durations (30:49:10).** expo-media-library's SDK 58 API returns `duration` in
  **milliseconds** on iOS and Android (its d.ts says seconds). It was formatted as seconds. The library
  now converts once in `mapAsset`, and all UI uses one helper, `formatDuration()` in
  `src/lib/format.ts` (m:ss, or h:mm:ss from one hour). `npm test` runs the pure-function checks in
  `scripts/check-format.mjs`.

**Added / finished**

- Resume: position saved per video in AsyncStorage (`playsz:resume:<id>`), resumes on open, and a
  progress bar on library and private-folder thumbnails.
- Gestures: left half vertical = brightness (expo-brightness, restored on exit), right half vertical =
  playback volume (`player.volume`), horizontal swipe = relative seek (screen width = 90 s, preview
  while dragging), double-tap left/right = −10 s / +10 s.
- Speed 0.5x–2x (0.25 steps), pitch preserved, saved.
- Loop (saved) and A-B repeat (tap A-B to set A, again to set B, again to clear; markers on the bar).
- Screen lock: hides controls and ignores all gestures; tap shows "Tap to unlock".
- Picture in picture (PiP button, and automatic on iOS when leaving the app) and background audio with
  the now-playing controls. Both are off for private-folder videos.
- .srt (and basic ASS/SSA) subtitles with saved styling: size S/M/L/XL, colour white/yellow/green/cyan,
  background shadow/box/solid, plus per-file ±0.1 s sync.
- Library sort: name, date, size, duration, ascending/descending, saved. Date and duration sort in the
  media store (paged); name and size sort on the device across all videos. Media-library metadata has
  no file size, so sizes are measured lazily (limited concurrency, cached per id + modificationTime);
  iCloud-only videos sort last under size.
- Private folder lock: Face ID / Touch ID / fingerprint via `expo-local-authentication`, with the device
  passcode as a fallback (`disableDeviceFallback: false`). The folder locks whenever the app goes to the
  background; an open private video stops and closes. Files live in
  `<documentDirectory>/private-folder/` and play from there; thumbnails are cached the same way and
  removed with the item. Behaviour is unchanged otherwise: adding copies (the original stays in
  Photos/gallery), Restore copies back to the media library, free tier = 10 items
  (`FREE_PRIVATE_FOLDER_ITEMS`), Pro unlimited through the existing paywall. The encrypted export also
  asks for the unlock. Private titles are not added to Recents.

**Config changes (app.json)**

```json
["expo-video", { "supportsPictureInPicture": true, "supportsBackgroundPlayback": true }],
["expo-local-authentication", { "faceIDPermission": "Playsz uses Face ID to lock and unlock your private folder." }]
```

Resulting native config (`npx expo config --type introspect`): iOS `UIBackgroundModes: ["audio"]`
(already set in `ios.infoPlist`, kept), `NSFaceIDUsageDescription` set; Android main activity
`android:supportsPictureInPicture="true"`, `ExpoVideoPlaybackService` (mediaPlayback foreground
service) added, `USE_BIOMETRIC` / `USE_FINGERPRINT` permissions added. `SYSTEM_ALERT_WINDOW` and
`WRITE_SETTINGS` are still removed. In code: `VideoView allowsPictureInPicture`,
`startsPictureInPictureAutomatically` (iOS), `player.staysActiveInBackground = true`,
`player.showNowPlayingNotification = true` for library videos.

## Tech stack

- Expo SDK 58, TypeScript, expo-router, React Native
- expo-video for the scaffold player (ExoPlayer on Android, AVPlayer on iOS)
- expo-media-library for the on-device video list
- AsyncStorage for resume positions, sort choice, subtitle style and player prefs
- expo-video-thumbnails for library thumbnails; expo-local-authentication for the private-folder lock
- react-native-gesture-handler for player gestures
- Planned, not in this build: Media3/ExoPlayer + FFmpeg and/or libVLC for production playback; whisper.cpp for v2 on-device subtitles

## Identifiers

| Platform | Identifier (final) |
| --- | --- |
| Android application id | `com.allinone.videoplayer` |
| iOS bundle identifier | `com.samayvashsht.playsz` |

Both are set in `app/app.json`. The Expo display name (`expo.name`) is the final app name, Playsz - All In One Player. The short launcher label is Playsz.

## Install and run locally

You need Node.js 20+ and a current Expo-compatible environment. For a device library and hardware playback, use an Android device/emulator or an iPhone/simulator. The web target cannot scan a device library and does not bundle a sample video.

```bash
cd app
npm install
npm run typecheck
npx expo start
```

Then press `a` for Android or `i` for iOS, or scan the QR code with Expo Go. Grant video/photo-library access when the home screen asks, then tap a video. Resume position is stored on the device and restored the next time you open the same file.

Useful scripts (run from `app/`):

```bash
npm run typecheck          # tsc --noEmit
npx expo start --android
npx expo start --ios
npx expo export --platform android
npx expo export --platform ios
```

Do not put secrets or tokens in this repo or in local env files that might be committed. `.env` files are gitignored. Support contact belongs on the public `site/` pages and in the store listing fields only, not in this README or in app source.

## Build with EAS

The EAS project is **@krosz/openplay** on the krosz Expo account: https://expo.dev/accounts/krosz/projects/openplay

`app/eas.json` defines three profiles:

- **development** — dev client, internal distribution
- **preview** — internal distribution; Android `apk`
- **production** — Android `app-bundle` (AAB). The production profile already builds an AAB, not a fat APK.

The Android upload keystore is generated and stored on EAS (not in this repo).

### iOS builds (not run yet)

Future iOS builds and App Store submission use Apple team ID **PGLT2QZX88** (seller: Sunny Vashisht, Individual). The team ID is set as `expo.ios.appleTeamId` in `app/app.json` (this eas-cli version does not allow `appleTeamId` under `eas.json` build profiles). Do not run `eas build -p ios` or `eas submit` until that is requested.

```bash
cd app
eas build -p android --profile development
eas build -p android --profile preview
eas build -p android --profile production
# iOS, when requested:
# eas build -p ios --profile development
# eas build -p ios --profile preview
# eas build -p ios --profile production
```

Production submits use `eas submit` only after the listings, hosted legal pages, and billing products are real.

## iOS simulator QA (GitHub Actions)

`.github/workflows/ios-sim-qa.yml` builds a Release iPhone simulator `.app`, seeds test videos, and drives the core flow with [Maestro](https://maestro.dev/) on a standard `macos-latest` runner. It does **not** use large or xlarge runners, and it does not need repo secrets.

Triggers: `workflow_dispatch` (optional `ref` input) and pushes to `release/playsz`. It does **not** run on pushes to other branches.

```bash
gh workflow run ios-sim-qa.yml --ref playsz/sim-qa
```

The job records a per-step PASS/FAIL/SKIP summary (cold launch timing, play each seeded video, seek, SRT subtitles, paywall prices, a test purchase) and uploads a screen recording, Maestro logs, and `results.json`. StoreKit prices come from `app/ios-storekit/Playsz.storekit`, which is attached to the generated Xcode scheme after prebuild. A StoreKit Configuration file may not take effect when the app is launched with `simctl` and driven by Maestro; that step is recorded as SKIP rather than a fake pass. A real App Store sandbox purchase on a device is still required before App Review.

## Legal URLs (required before QA)


Public legal pages live in `site/` (`index.html`, `privacy.html`, `terms.html`) and are accepted as final. The operator/publisher, copyright holder, and grievance officer named on those pages is Samay Vashsht (`© 2026 Samay Vashsht`). Contact on those pages is email only; no phone number is published. The postal address is still pending, so the pages carry a clearly marked `Postal address: pending` placeholder. That address must be confirmed and filled in before the site is published.

Terms and Privacy links in the app are read from `app/src/constants/legal.ts`. They are set to the planned GitHub Pages URLs (`https://samayhuf-star.github.io/app-legal/playsz/privacy.html` and `https://samayhuf-star.github.io/app-legal/playsz/terms.html`) with `PENDING_HOSTING = true`. The paywall and Settings show the links now. Those URLs will **404 until GitHub Pages is published** from the `site/` folder. Flip `PENDING_HOSTING` to false once the pages are actually live.

**QA and store submit still require those two URLs to be live** and to match the `site/` pages. There is no sign-up, so there is no account-deletion flow.

The copyright line `© 2026 Samay Vashsht` appears on the public `site/` pages, in the store listings, and on the in-app Settings/About screen. The Apple seller (Sunny Vashisht, Individual, team PGLT2QZX88) is documented for App Store Connect and internal iOS build notes only; it is not the publisher name on the public pages.

## Icons and splash

The mark is an original play-button on a dark field (no third-party art). Source SVG: `app/assets/source/icon-mark.svg`. Raster sizes are produced locally:

```bash
cd app
npm run icons    # node scripts/render-icons.mjs (uses sharp)
```

Outputs, all wired in `app/app.json`:

- `assets/images/icon.png` — 1024×1024, RGB, no alpha (iOS and app icon)
- `assets/images/android-icon-background.png` / `android-icon-foreground.png` / `android-icon-monochrome.png`
- `assets/images/splash-icon.png` and `favicon.png`

## Paywall setup

The app integrates **expo-iap** (MIT) against Google Play Billing and Apple StoreKit. There is no RevenueCat and no backend. Entitlements are saved on the device. The paywall screen loads prices from the store; if the store returns none, it shows a clear unavailable state and will not pretend a local price is a store price. Buy, restore, cancel, and failure are handled. Auto-renewal is disclosed on the paywall. Capped extras (3 successful M4A exports per day, 10 real private-folder items, Pro-only encrypted export) are gated from Settings and open the paywall when a cap is hit. Failed or cancelled exports are not counted. Stubs are not shipped behind the paywall.

Final USD prices (not proposals):

| Product id (final) | Type | Price |
| --- | --- | --- |
| `playsz_pro_monthly` | Auto-renewing subscription | $2.99 / month |
| `playsz_pro_yearly` | Auto-renewing subscription | $9.99 / year |
| `playsz_pro_lifetime` | One-time unlock | $29.99 |

Suggested regional equivalents (INR, IDR, PHP, AED, SAR) are in [docs/PAYWALL_PLAN.md](docs/PAYWALL_PLAN.md) and are suggestions only.

Billing approach: **Google Play Billing** and **Apple StoreKit only**, through an open-source on-device library such as **expo-iap** or **react-native-iap** when that screen is built. Entitlement checks stay on the device. There is no RevenueCat and no receipt-validation backend. Create the three product ids in Play Console and App Store Connect before wiring the library. A 7-day opt-in trial is planned for the yearly plan only, with a 24-hour local reminder before the first charge. Restore purchases must be visible on the paywall and in Settings.

Free is the full player with caps on extras (exports and private-folder size). Pro lifts those caps and later unlocks on-device AI subtitles and SMB/DLNA. There are no ads to remove.

## Current status and TODOs

**Status:** Expo SDK 58 app in `app/` with a library (folders, recents, search, paging), player (working brightness/volume gestures, SRT/ASS subtitles, resume), Settings (About/copyright, real extras), and a paywall wired to expo-iap and on-device entitlements. Original icons and splash are generated from a first-party SVG. Docs, including the QA map, are in place. Git is local only. The EAS project is @krosz/openplay. No store submit. This is **not** a QA PASS. See [docs/QA_STATUS.md](docs/QA_STATUS.md).

**TODOs**

- The app name (Playsz - All In One Player) and Android package `com.allinone.videoplayer` and iOS bundle id `com.samayvashsht.playsz` are confirmed.
- Publish the `site/` legal pages to the planned GitHub Pages URLs (they 404 until hosted), then set `PENDING_HOSTING` to false in `app/src/constants/legal.ts`. Confirm the postal address before publishing those pages.
- Replace or extend expo-video with an open-source engine that covers 4K and EAC3/Dolby on mid-range devices; verify lock-in-format playback before advertising it.
- Finish Settings > Delete my data. Audio export, the private folder, and encrypted export/import already ship (M4A remux and AES-GCM archive via the local `playsz-native` module).
- Create the three store products and sandbox-test buy, cancel, failure, and restore on a dev-client or store binary.
- Add the yearly trial reminder once store trials are configured.
- Build on-device AI subtitles (v2) and SMB/DLNA (v2) with open-source code only.
- Capture store screenshots from a real build. Copyright holder is Samay Vashsht. Confirm the Google Play developer name and address before store submit.
- The EAS project @krosz/openplay and `app/eas.json` profiles already exist. Nothing ships to a store without a Testing E2E Bot PASS.

## Dependencies and licenses

Direct dependencies of the Expo app in `app/package.json`. Versions are what the scaffold was generated and installed with (Expo SDK 58). All of these are open source. Transitive packages in `node_modules` are also open source and are not listed one-by-one.

### Runtime

| Package | Version | License |
| --- | --- | --- |
| @expo/ui | 58.0.28 | MIT |
| @react-native-async-storage/async-storage | 2.2.0 | MIT |
| expo | 58.0.24 | MIT |
| expo-constants | 58.0.16 | MIT |
| expo-device | 58.0.5 | MIT |
| expo-font | 58.0.12 | MIT |
| expo-glass-effect | 58.0.5 | MIT |
| expo-iap | 6.4.3 | MIT |
| expo-image | 58.0.18 | MIT |
| expo-linking | 58.0.17 | MIT |
| expo-local-authentication | 58.0.3 | MIT |
| expo-media-library | 58.0.14 | MIT |
| expo-router | 58.0.31 | MIT |
| expo-splash-screen | 58.0.14 | MIT |
| expo-status-bar | 58.0.5 | MIT |
| expo-symbols | 58.0.5 | MIT |
| expo-system-ui | 58.0.7 | MIT |
| expo-video | 58.0.14 | MIT |
| expo-video-thumbnails | 58.0.3 | MIT |
| expo-web-browser | 58.0.8 | MIT |
| react | 19.3.0 | MIT |
| react-dom | 19.3.0 | MIT |
| react-native | 0.88.1 | MIT |
| react-native-gesture-handler | 3.3.0 | MIT |
| react-native-reanimated | 4.7.1 | MIT |
| react-native-safe-area-context | 5.11.1 | MIT |
| react-native-screens | 4.30.1 | MIT |
| react-native-web | 0.21.4 | MIT |
| react-native-worklets | 0.13.0 | MIT |

### Development

| Package | Version | License |
| --- | --- | --- |
| @types/react | 19.3.0 | MIT |
| typescript | 6.0.3 | Apache-2.0 |
| sharp | 0.35.5 | Apache-2.0 |

### Planned open-source additions (not installed)

| Library | Role | Expected license |
| --- | --- | --- |
| expo-iap (installed) or react-native-iap | Play Billing and StoreKit on the device | MIT |
| Media3/ExoPlayer + FFmpeg and/or libVLC | Production format and Dolby-audio coverage | Apache-2.0 / LGPL-style (confirm and comply at add time) |
| whisper.cpp (v2) | On-device speech-to-text / translation | MIT (confirm at add time) |

FFmpeg and libVLC have license obligations (LGPL/GPL variants depending on the build). When they are added, ship the required notices and, if needed, offer the corresponding source. Do not add a package whose terms require a paid license or a network API key.
