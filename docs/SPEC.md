# Playsz — Product Spec

**App name (final):** Playsz - All In One Player. Android application id `com.allinone.videoplayer`; iOS bundle identifier `com.samayvashsht.playsz` (com.allinone.videoplayer was taken on Apple) (final). Offline video player built to beat PLAYit (`com.playit.videoplayer`), launching on **Android and iOS together**.

**Research basis:** PLAYit teardown (Play listing, official site, security scans, press) and 772 one- and two-star reviews from India, US, Indonesia, UAE, and Philippines storefronts (11 Nov 2026). About 40% of classified negative reviews are about ads; 18% historically about file lock-in; core playback (4K, EAC3/Dolby, Bluetooth, playlists, resume) still fails in 2026 reviews.

**Hard constraint — no third-party APIs and no paid services or access.** Everything is built in-house. Open-source libraries are allowed. Store-required billing (Google Play Billing and Apple StoreKit) is allowed through an open-source on-device IAP library. There is no backend, no RevenueCat, no ad networks, no cloud APIs, no analytics or crash-reporting SDKs, and no paid model APIs. See `README.md` and `docs/PAYWALL_PLAN.md`.

## Problem

PLAYit has 500M+ installs and a 4.4–4.7 rating, but users are angry about ads on pause, resume, next video, overlay, and even offline or background music; files saved in a Smart Muxer format only PLAYit can play; stuttering 4K and missing audio; a private folder that can lose files; heavy permissions (location, camera, running apps) with no in-app data deletion; and a subscription-only ad-removal paywall with surprise trial charges and lost entitlements. Feature sprawl (Game Hall, feeds, AI photo-to-video) dilutes the player. Roughly 836K Play raters gave 1–2 stars — a reachable switcher pool.

## Target users

Primary: Android and iPhone users in **India**, **Southeast Asia** (Indonesia, Philippines), and **MENA** who already keep videos on the device (WhatsApp status, files they own, camera recordings, MKV/MP4 movies) and want a reliable local player. Secondary: PLAYit/VidMate users who cannot open locked files elsewhere, and users who want a player with no ads and no cloud account. Languages to support first: English, Hindi, Indonesian (Bahasa), Arabic, then Tamil, Telugu, Bengali, Filipino. Stay out of piracy-sourced content feeds.

## Core features

### MVP (first Play and App Store release)

- Local library scan (videos on device and SD card): folders, recents, search.
- Playback of common formats (MP4, MKV, AVI, WebM, FLV, TS, MOV, 3GP) with hardware decode first and software fallback. Target smooth 1080p on mid-range and 4K on capable devices. Production engine: **Media3/ExoPlayer + FFmpeg** and/or **libVLC** (open source) for EAC3, AC3, DTS, TrueHD so "no sound" is rare. The Expo scaffold uses expo-video until that native engine lands — launch claims must wait until it does.
- **No ads anywhere** — not on the player, not on pause/resume/seek/next/exit, not offline, not in the library, and not in background audio.
- Resume from last position per file (stored on-device); gapless playlists; Bluetooth- and call-safe continuation.
- MX Player / VLC-style gestures: horizontal seek, vertical volume/brightness, double-tap skip, speed 0.25–4x, screen lock.
- Background audio play and picture-in-picture / popup player.
- Embedded subtitles plus **local** external files (SRT/ASS) and manual import. Sync offset saved per file on-device. No online subtitle APIs.
- Video-to-MP3 export, written only as standard MP3/MP4/MKV — **no proprietary lock-in**. Free tier is capped; Pro is unlimited (see paywall plan).
- Import/play hook: open PLAYit/VidMate Smart Muxer files where legally and technically possible, and help convert the user's own files to standard formats.
- Private folder with a recovery key. Files must not silently vanish. Backup is a **local encrypted export/import** the user copies to their own storage — no cloud.
- Minimal permissions: video/media access only by default. No location, camera, contacts, or "draw over other apps" unless the user turns on a feature that needs it (e.g. PiP). In-app deletion of local app data.
- Monetization: Pro via store subscriptions and a lifetime purchase only. Entitlements checked on-device. No ad SDK.
- Reply to 1–3 star store reviews within 48 hours.

### v2 (after MVP is stable)

- On-device AI subtitles and translation using open-source models (for example **whisper.cpp** via a native module) for Hindi, Tamil, Telugu, Bengali, Bahasa, Arabic, and English. No cloud speech APIs. Ships in v2 unless the on-device path is ready earlier.
- Network streaming over open protocols only: **SMB** and **DLNA/UPnP**, implemented with open-source code. No Google Cast SDK and no other vendor cast SDK.
- Equalizer, sleep-timer polish, HDR/AV1 (dav1d) tuning. Any quality telemetry stays on the device as local logs — nothing is uploaded.
- Localized store listings and in-app UI beyond the first language set.

### Explicitly excluded

- **No YouTube or social-video downloader** (store policy and legal risk). No link-grabbers, "online search," or site-specific downloaders.
- No Game Hall, coin economy, content/status feed, or AI photo-to-video clutter.
- No third-party APIs, no paid APIs, no backend, no RevenueCat, no ad networks, no Firebase/Sentry or other analytics/crash SaaS, no OpenSubtitles, no cloud backup, no Google Cast.

## Platforms

- **Android and iOS launch together**, same Expo codebase and the same product surface.
- Android 8+ (Play Store) and iOS (App Store). Phone is the primary target; tablet layouts must not be broken (`supportsTablet` is on).
- Android TV is v2, not a launch blocker. Casting/streaming in v2 is SMB and DLNA/UPnP only.
- No web or desktop product in this phase. Web is used only as a local dev aid.

## Tech stack

- Expo SDK 58, TypeScript, expo-router, React Native.
- Scaffold / UI: expo-video (ExoPlayer on Android, AVPlayer on iOS), expo-media-library, AsyncStorage for resume position, React Native Gesture Handler.
- Production playback (MVP hardening): extend or replace expo-video with **Media3/ExoPlayer + FFmpeg** and/or **libVLC**. Keep Expo for UI and config plugins.
- Billing: **Google Play Billing** and **Apple StoreKit** (required by the stores for digital goods) through an open-source on-device library such as **expo-iap** or **react-native-iap**. Entitlement state is stored and checked on the device. No billing backend and no RevenueCat.
- Logging: local logs only. No analytics or crash-reporting SDKs.
- See `README.md` for every current dependency and its license.

## Monetization

Free is a complete local player: all playback, gestures, resume, background play, local subtitles, and standard-format exports, with **caps on a small set of extras**. There are no ads in any tier. Pro (monthly, yearly, or lifetime) lifts those caps and unlocks the remaining extras as they ship (unlimited exports, unlimited private folder, local encrypted vault export/import, on-device AI subtitles in v2, SMB/DLNA in v2).

**Final USD prices:** $2.99 / month, $9.99 / year, $29.99 lifetime. Suggested regional equivalents may be listed in the paywall plan and are suggestions only. Details in `docs/PAYWALL_PLAN.md`.

## Success metrics

(Tracked from store consoles and on-device logs we do not upload; no third-party analytics.)

- Store rating ≥ 4.6 in India within 90 days of launch, with 1–2 star share well below PLAYit's ~12%.
- Crash-free feel on mid-range Android and current iPhones; 4K/EAC3 issues recorded in local logs by device model during QA, not in production telemetry SaaS.
- D1 / D7 retention inferred from store metrics and return-visit QA, not from an analytics SDK. "Completed a playback without interruption" is the product goal.
- Pro conversion (monthly + yearly + lifetime) and refund rate; trial-to-paid with zero "surprise charge" reviews.
- Review response time: every 1–3 star review answered within 48 hours.
- Permission grant rate and store-policy compliance (no downloader, honest privacy labels, no undeclared data collection).

## Risks

- **Playback quality on low-end Android** is the product. If 4K or EAC3 fails, we look like PLAYit. Device testing in India is mandatory before launch claims.
- **expo-video is not enough** for Dolby audio and odd containers; the native open-source engine must land in MVP, not v2.
- **Smart Muxer compatibility** may be legally or technically constrained; market it only after we can actually open those files.
- **Play Photo and Video Permissions policy** and Apple's photo-library purpose strings: request video access, justify it, and avoid unused photo access.
- **On-device entitlements without a backend** can be tampered with on jailbroken/rooted devices. Accept that risk rather than adding a server. Use store APIs (StoreKit 2 / Play Billing) and obfuscate only lightly; do not add a paid DRM service.
- **On-device AI** (whisper.cpp) will be large and slow on low-end phones; that is why it is v2 and must stay optional/downloadable as an on-device model pack the user chooses, not a cloud call.
- **Store listing claims** must match the binary. Do not submit 4K/EAC3/PLAYit-file/AI-subtitle copy until those paths are tested.
- **Trademark / naming:** The official name is "Playsz - All In One Player" (final). Still clear trademark and store uniqueness before submit. Do not use PLAYit's exact phrase "All in One Video Player" as a standalone title.
