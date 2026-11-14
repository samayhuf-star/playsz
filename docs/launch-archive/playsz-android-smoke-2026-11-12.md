# Playsz (OpenPlay) — Android smoke test

**Date:** 12 November 2026, Asia/Dhaka (UTC+6)  
**Tester:** Testing E2E Bot (early smoke, not the final launch QA gate)  
**App:** Playsz – All In One Player, built as **OpenPlay** from commit `23ecd78` (pre-rename; OpenPlay name and `openplay_*` product IDs are expected and are not logged as issues)  
**Package:** `com.allinone.videoplayer`  
**Version:** 1.0.0 (versionCode 1)  
**APK:** https://expo.dev/artifacts/eas/E3roTOw11HCjcjn1izsmCtXYnJGLtZ3dRuNqEdbfMh0.apk (98.1 MiB / 102,905,258 bytes)  
**Build page:** https://expo.dev/accounts/krosz/projects/openplay/builds/9ff549bf-45e3-4072-b767-e0932ddcc775  
**Checklist:** `/home/box/shared/app-monitor/qa-checklist.md` P0 / P1 / P2  
**Result:** **not a PASS.** This is an early smoke. Device install/launch did not complete. Findings below mix on-device attempts with static analysis of the APK and of source at `23ecd78`.

---

## How it was tested

### Emulator (attempted; install never succeeded)

- `/dev/kvm` exists. After `chmod 666`, KVM was readable. `emulator -accel-check` reported KVM usable.
- Android SDK was already at `/home/box/android-sdk`. Installed image used: `system-images;android-35;google_apis;x86_64` (API 34 was not installed; API 35 was). A lean Pixel 6 AVD `playsz_api35` was created (1536 MB guest RAM; the emulator process raised it to 2560 MB).
- **KVM boot failed.** Two `qemu-system-x86` starts (this AVD and another agent's `mb35`) hit a host kernel bug: `kernel BUG at arch/x86/kvm/x86.c:689!` in `kvm_spurious_fault` during `kvm_arch_vcpu_create` (12 Nov 2026, 01:02 and 01:03 Asia/Dhaka). The QEMU processes hung at ~250 MB RSS, 0.4% CPU, with adb `offline` and a dead console on ports 5554/5555. Hardware acceleration is not usable on this box right now.
- **Software emulation (TCG, `-accel off`) was started as the fallback.** Warning: `x86_64 emulation may not work without hardware acceleration.` The AVD did come up as `emulator-5554 device` (Android 15 / API 35, `sdk_gphone64_x86_64`), and `sys.boot_completed` eventually became `1`. First boot was slow (TCG plus `dex2oat` of system apps, e.g. Chrome ~84 s). The 98 MB APK was pushed to `/data/local/tmp/playsz.apk`.
- **`pm` / `adb install` never succeeded.** While services were still coming up, install failed with `Can't find service: package`, then `StorageManager.getVolumes()` NPE, then `PackageManagerInternal.freeStorage` NPE, then `Failure calling service package: Broken pipe`. The package service flapped (found / not found). A first TCG session was also shut down externally (`Wait for emulator (pid …) 20 seconds to shutdown gracefully`) before a retry. A second TCG boot reached the same install failures.
- **No APK was installed, so there are no on-device screenshots of the running app, no logcat crash/ANR pass, and no playback / paywall / permission / layout runs.** Test media (mp4/h264, mkv, webm, mov, avi, hevc, srt) was generated with ffmpeg under `/tmp/playsz-qa/media/` but never pushed into the device library.
- The TCG emulator was stopped after the install attempts to free RAM.

### Static analysis (completed)

- `aapt` / `apkanalyzer` on the APK: badging, permissions, target/min SDK, adaptive icon, `app.config`, native ABIs (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`).
- Hermes bytecode bundle `assets/index.android.bundle` (3.4 MiB, magic `c61fbc03`). Product IDs and UI copy confirmed via `strings` plus the matching source.
- Source at **commit `23ecd78`** in `/workspace/allinone-video-player` (the stated build commit): `caps.ts`, `products.ts`, `entitlement.ts`, `iap-provider.tsx`, `paywall.tsx`, `settings.tsx`, `index.tsx`, `player.tsx`, `_layout.tsx`, `legal.ts`, `app.json`, icons, docs.
- Resource values: `is_expo_go=false`, splash resize `contain`, `userInterfaceStyle=automatic`.
- Icons from the repo at that commit (not default Expo artwork): 1024×1024 RGB, no alpha; adaptive background/foreground/monochrome; splash mark. Copies (clearly labelled **not device shots**):
  - `/home/box/shared/screenshots/apps/playsz/source-icon-1024-not-device.png`
  - `/home/box/shared/screenshots/apps/playsz/source-adaptive-foreground-not-device.png`
  - `/home/box/shared/screenshots/apps/playsz/source-splash-icon-not-device.png`

No app, repo, or build was edited. No real purchases were attempted.

---

## Issue list

### 1. P0 — Privacy Policy and Terms URLs are empty; paywall has no live legal links

- **Area:** Paywall / privacy (checklist P0 #3, P0 #4)
- **Steps:** Open the in-app paywall (header “Unlock Pro”, or Settings → Unlock Pro). Look for Terms and Privacy links.
- **Expected:** Live, accurate Privacy Policy and Terms URLs, linked from the paywall (and listing, when submitted).
- **Actual:** In `app/src/constants/legal.ts` at `23ecd78`, `LEGAL_URLS.terms` and `LEGAL_URLS.privacy` are empty strings by design. The paywall therefore renders the fallback copy: “Terms and Privacy links will appear here once their live URLs are set in the app config. They are required before QA and store submit, and are not pointed at a placeholder host.” Settings has no legal links at all. Auto-renew disclosure *is* present. This build does not ship `site/privacy.html` or `site/terms.html` (those files appear only in later commits); even current `HEAD` still leaves `LEGAL_URLS` empty.
- **Screenshot:** not tested on device (no install). Source: `app/src/constants/legal.ts`, `app/src/app/paywall.tsx`.

### 2. P1 — “Export a video to audio” is a stub but still consumes the free daily cap (4th tap opens paywall)

- **Area:** Exports / core flow (checklist P1 #13; requested cap check)
- **Steps:** Settings → “Export a video to audio”, tap four times on a free (non-Pro) entitlement, without a real encoder run.
- **Expected:** A successful export writes a standard audio file. Free tier allows 3 successful exports per day; the 4th is blocked and the user is sent to the paywall. Failed or unimplemented exports should not burn the quota.
- **Actual:** `tryConsumeExport()` increments `openplay:caps:exports` in AsyncStorage *before* any encoding, then Settings shows: “Export counted (N of 3 today). The encoder itself ships in a later build.” There is no file picker and no output file. After 3 increments, the 4th call returns `allowed: false`, sets “Free exports are capped at 3 per day. Unlock Pro for unlimited exports.” and navigates to the paywall. Pro skips the cap but still only shows “The encoder itself ships in a later build.”
- **Screenshot:** not tested on device. Source: `app/src/lib/caps.ts`, `app/src/app/settings.tsx`, `FREE_EXPORTS_PER_DAY = 3`.

### 3. P1 — Private folder is a counter only; 11th add opens paywall; count never decreases

- **Area:** Private folder / core flow (checklist P1 #13; requested 10-item limit)
- **Steps:** Settings → “Add to private folder” eleven times on a free entitlement. Then try to remove an item and add again.
- **Expected:** A real private folder that stores (and can remove) items, with a recovery path as in the spec. Free cap of 10 items; the 11th is blocked and the user is sent to the paywall.
- **Actual:** `tryAddPrivateItem()` only increments `openplay:caps:private-folder-count` in AsyncStorage. No file is copied, there is no folder UI, no recovery key, and no remove path, so the count never decrements. After 10 adds it shows “Private folder now has 10 item(s).” The 11th returns `allowed: false`, “The free private folder is capped at 10 items…”, and opens the paywall. “Local encrypted export” is also a stub (“Encrypted export will write a local archive in a later build.” / “Local encrypted export is a Pro extra.”).
- **Screenshot:** not tested on device. Source: `app/src/lib/caps.ts`, `app/src/app/settings.tsx`, `FREE_PRIVATE_FOLDER_ITEMS = 10`.

### 4. P1 — No subtitle support in this build

- **Area:** Local playback / subtitles (requested check)
- **Steps:** Play a video that has a sibling `.srt` (or use a manual import control).
- **Expected:** If subtitles are supported, embedded and/or external SRT (and ideally ASS) can be shown and synced.
- **Actual:** `player.tsx` uses `expo-video` `VideoView` with custom controls only (play/pause, seek bar, double-tap skip, swipe seek). There is no subtitle track selector, no SRT/ASS import, and no overlay. The product spec lists local subtitles as an MVP item; this binary does not implement them.
- **Screenshot:** not tested on device. Source: `app/src/app/player.tsx`.

### 5. P2 — Player volume / brightness gestures are visible stubs

- **Area:** Player UX (checklist P1 #13 / P2)
- **Steps:** In the player, vertical-swipe on the left (brightness) or right (volume).
- **Expected:** Gestures adjust system brightness and playback volume, or the incomplete control is not shown as if it already works.
- **Actual:** `onVerticalGesture` is explicitly stubbed. The user-visible hint says “Gesture stub — will drive system brightness” / “Gesture stub — will drive playback volume.”
- **Screenshot:** not tested on device. Source: `app/src/app/player.tsx`.

### 6. P2 — `SYSTEM_ALERT_WINDOW` is in the release manifest but unused

- **Area:** Permissions (checklist P0 #5 “minimal permissions”)
- **Steps:** Inspect the merged manifest; look for any overlay / “draw over other apps” flow.
- **Expected:** Only the permissions the app needs. “Draw over other apps” only if the user turns on a feature that needs it (spec: PiP / popup).
- **Actual:** The APK declares `android.permission.SYSTEM_ALERT_WINDOW`. It is **not** listed in `app.json` at `23ecd78`. App code never requests or explains it. `expo-video`’s own manifest only adds `INTERNET` and a PiP-capable fullscreen activity (PiP does not need this permission). In the local `node_modules`, the string appears in React Native **debug** manifests only; it still landed in this **release** APK. Other declared permissions look reasonable for a local player: `READ_MEDIA_VIDEO`, `READ_MEDIA_VISUAL_USER_SELECTED`, `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` (maxSdk 32), `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `BILLING`, `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `VIBRATE`. Video usage copy exists for iOS / the media-library plugin; Android will use the system prompt. In-app deny UI is coded on the home screen (“Allow access to your videos” + “Grant video access”) and should not crash — **not verified on device**.
- **Screenshot:** n/a (manifest). `aapt dump permissions` / `apkanalyzer manifest permissions`.

### 7. P2 — Dark theme is forced; light mode and large-font / multi-size layouts are untested

- **Area:** Layout (checklist P1 #15)
- **Steps:** System light mode, large font / font scale, small phone, large phone, tablet.
- **Expected:** Layout works in dark and light (or a documented dark-only app), at large font, on small/large phones and tablet, with safe areas.
- **Actual:** `userInterfaceStyle` is `automatic`, but `_layout.tsx` always uses `DarkTheme` and `Colors` are a single dark palette (`#0B0D12` background, light text). Safe areas are used on home, settings, paywall, and the player. `supports-screens` includes small/normal/large/xlarge; iOS `supportsTablet` is true. **None of this was exercised on a device.**
- **Screenshot:** not tested on device. Source: `app/src/app/_layout.tsx`, `app/src/constants/colors.ts`.

### 8. P2 — Library is a flat 200-item scan (no folders / search)

- **Area:** Core library (checklist P1 #13)
- **Steps:** Open the home library after granting video access.
- **Expected:** Spec MVP: folders, recents, search, device + SD scan.
- **Actual:** Home runs `requestPermissionsAsync` immediately, then a `Query` of videos ordered by modification time, `limit(200)`. Empty state tells the user to copy an MP4 or MKV and pull to refresh. No folder tree, no search, no recents tab.
- **Screenshot:** not tested on device. Source: `app/src/app/index.tsx`.

### 9. P2 — Large fat APK (four ABIs)

- **Area:** App size (checklist P2 #19)
- **Steps:** Measure APK / download size.
- **Expected:** A reasonably sized Play upload; ABI splits or an Android App Bundle for store.
- **Actual:** Universal APK is 98.1 MiB with `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`. `apkanalyzer` estimated download size ~38.9 MiB. Fine for a smoke artifact; heavy as a Play “APK” without an AAB / splits.
- **Screenshot:** n/a.

---

## What passed (static / code review only)

- **No classic placeholders** in the app binary or `legal.ts`: no lorem, no `example.com`, no dummy prices in the paywall UI. Prices come from `expo-iap` `displayPrice`. If the store returns nothing, the UI shows “Prices unavailable” / “Unavailable from the store” and the CTA is disabled (“Selected plan unavailable”). Nothing is charged until a real store price is shown.
- **Paywall structure (code):** yearly / lifetime / monthly plan cards, “Most popular” / “Best value” badges, auto-renew disclosure (24-hour cancel window, store account charge, lifetime does not renew), Restore purchases button. Cancel → “Purchase cancelled.” Failure → “Purchase failed. Please try again.” Restore with no purchase → “No Pro purchase was found for this store account.” Unlock is persisted on-device via AsyncStorage (`openplay:entitlement:pro`).
- **Product IDs in the bundle** (expected for this pre-rename build, not issues): `openplay_pro_monthly`, `openplay_pro_yearly`, `openplay_pro_lifetime`.
- **Release flags:** `is_expo_go` is `false`. Expo Updates `ENABLED` is false in the manifest. No ratings prompt on first launch (none is implemented). No analytics / crash-reporting SDKs (N/A under Samay’s rule).
- **Icons / splash:** original play-button mark, not the default Expo icon. `icon.png` is 1024×1024 RGB with no alpha. Adaptive icon XML references background, foreground, and monochrome. Splash uses `#0B0D12` and a first-party mark.
- **Content rights:** no bundled sample video or third-party artwork in the APK (`assets/` is only `app.config`, the Hermes bundle, and dexopt profiles).
- **Account deletion:** N/A — no sign-up or account system.
- **SDK levels:** minSdk 24 (Android 7), targetSdk 36. `requestLegacyExternalStorage` is set (legacy, limited by maxSdk 32 on storage permissions).
- **Home deny path (code only):** if video permission is not granted (and not limited), the library is cleared and a rationale screen is shown; the catch path sets an error string instead of crashing.
- **Offline (code only):** local playback does not require a network. The paywall already has an “unavailable store / no products” state, which is also what a Play-less emulator or airplane mode should hit. There is no separate offline banner.

---

## Pending / not tested on device

Mark these **not tested on device**:

1. Install, cold start, launch, splash, and first-frame time.
2. Crashes / ANRs (logcat) on cold start, every screen, background/resume, rotation, and offline.
3. Local playback of mp4/h264, mkv, webm, mov, avi, hevc, and SRT (files were generated; never delivered to a running app). Format support will be whatever `expo-video` / Media3 on the device can decode — there is no FFmpeg/libVLC engine in this build (the spec still calls that out as future work).
4. Real private-folder and export UX, including the 11th item and 4th export, beyond the source-level behaviour above.
5. Paywall prices actually loading from Google Play (this image had Play Store disabled; even a successful install would almost certainly take the “Prices unavailable” fallback). Restore with and without a store account, sandbox buy, cancel sheet, and unlock persistence after process death.
6. Permission prompt **timing and wording** on Android 15, limited/partial photo access, and “deny does not crash” on a real device. Overlay permission is unused, so it was not prompted.
7. Airplane mode / network-off behaviour of library, player, and paywall.
8. Layout on a small phone, large phone, and tablet; dark vs light; large font; cutouts / safe areas; rotation in the player.
9. iOS / TestFlight — out of scope for this Android smoke (QA cannot run an iOS simulator here).
10. Store listing, screenshots at required sizes, Play Data safety form, version bump / release notes, and a README-vs-secrets pass on a release checkout (README at this commit still describes IAP / engine as partly unbuilt; no secrets were seen in `app.json`).

---

## Manifest / binary snapshot (for the video-player bot)

| Item | Value |
| --- | --- |
| package | `com.allinone.videoplayer` |
| versionName / versionCode | 1.0.0 / 1 |
| minSdk / targetSdk | 24 / 36 |
| application-label | OpenPlay |
| deep link scheme | `openplay` |
| IAP | Play Billing 9.1.0, `dev.hyo.openiap` / expo-iap |
| allowBackup | true |
| ABIs | arm64-v8a, armeabi-v7a, x86, x86_64 |
| APK size / estimated download | 98.1 MiB / ~38.9 MiB |

This smoke does **not** authorise a store submit. Final launch QA still needs a renamed build, a device or a stable emulator/install, live `LEGAL_URLS`, working export/folder (or copy that does not claim they work), and a Play-backed paywall pass.
