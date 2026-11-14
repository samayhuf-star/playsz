# Playsz — Android retest (92f6bdf)

**Date:** 12 November 2026, Asia/Dhaka (UTC+6)  
**Commit:** `92f6bdf3b68c3d1799c6f9b948ca32f0ee45385e`  
**Package:** `com.allinone.videoplayer` 1.0.0 (versionCode 1)  
**Preview APK:** https://expo.dev/artifacts/eas/7JmLBFP5kLZDjNn-o5r_MD14n-j0iw7vlS__772l5RI.apk (EAS `34090523`, 98.2 MiB / 102,989,186 bytes; download estimate 38.9 MiB)  
**Production AAB:** https://expo.dev/artifacts/eas/hYarb_OGqEHVW-mP_Ew5QbMe3GYFhnYf5PuYHzW7XSs.aab (EAS `f3d53c72`, 72.1 MiB / 75,565,142 bytes)  
**Result:** **FAIL** as a launch pass. Static retest of the nine smoke items is largely good. Firebase Test Lab did not run (storage 403). Sandbox IAP was not exercised.

gcloud: SDK 593.0.0 at `/home/box/shared/tools/google-cloud-sdk`; service account `qa-testlab@krosz-apps.iam.gserviceaccount.com` activated on project `krosz-apps`; `gcloud firebase test android models list` works. Spark quota used: **0 / 5** physical, **0 / 10** virtual. Planned (not run): one Robo matrix, Pixel 8 (`shiba`, API 35) + Galaxy A03s (`a03su`, API 33).

---

## PASS / FAIL

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | Legal links in the app (not empty) | **PASS (code)** / **known hosting gap** | `LEGAL_URLS` are `https://krosz.github.io/openplay/terms.html` and `…/privacy.html` in source and the Hermes bundle. Paywall and Settings render Terms/Privacy plus the in-app “will 404 until hosted” note. Live GET of both URLs (and the site root) returns **HTTP 404** GitHub Pages “Site not found.” Not logged as a code failure. |
| 2 | Export no longer burns the cap on a stub | **PASS (static)** | Stub copy is gone. `exportVideoAudio` remuxes AAC to M4A; `recordSuccessfulExport()` runs only after a successful export (`settings.tsx`). Device export not run. |
| 3 | Private folder is a real folder | **PASS (static)** | Files are copied into app-private storage, listed, removable, and the cap uses the real item count (`private-folder.ts`, Settings + `/private-folder`). Device folder not run. |
| 4 | Subtitles | **PASS (static)** | Player loads SRT/ASS, shows cues, and has an import + offset control. Stub-free in the bundle. Device playback not run. |
| 5 | Volume / brightness gestures | **PASS (static)** | “Gesture stub” strings are gone. Gestures set window brightness (`expo-brightness`) and `player.volume`. Device gestures not run. |
| 6 | `SYSTEM_ALERT_WINDOW` / `WRITE_SETTINGS` absent from merged manifests | **PASS** | Both the preview APK (`aapt dump permissions` / xmltree) and the production AAB (`bundletool dump manifest`) omit `SYSTEM_ALERT_WINDOW` and `WRITE_SETTINGS`. The APK has no `SYSTEM_ALERT_WINDOW` string at all. `WRITE_SETTINGS` still appears in `classes.dex` (SDK leftover) but is **not** a manifest permission. |
| 7 | Light / dark theme | **PASS (static)** | `LightColors` + `DarkColors`; `_layout` follows `useColorScheme`. Not screenshot-verified. |
| 8 | Library folders / recents / search | **PASS (static)** | Home has Folders, Recents, and search (`index.tsx`). Not screenshot-verified. |
| 9 | App size | **PARTIAL** | Preview APK is still a 98.2 MiB 4-ABI fat APK (similar to the earlier smoke). Production is now an AAB (72.1 MiB). |
| — | Paywall is on and opens | **PASS (static)** | No off flag. Bundle has “Unlock Pro”, “Playsz Pro”, “Restore purchases”, and product IDs `playsz_pro_monthly` / `_yearly` / `_lifetime`. Prices are store-loaded. **Not opened on a device.** Sandbox buy / restore / unlock still need a human or scripted IAP pass (Robo cannot purchase). |
| — | Launcher / manifest label is exactly `Playsz - All In One Player` | **FAIL** | `expo.name` / `app.config` is `Playsz - All In One Player`. Merged APK and AAB `android:label` (and every `application-label-*`) is **`Playsz`**, set by `app/plugins/with-launcher-label.js`. Launcher will show `Playsz`. |

---

## Numbered issues

1. **Blocker (Test Lab, not an app defect)** — Device run did not start. After a 20 s retry, `gcloud firebase test android run` failed with `403 storage.objects.create` on `gs://test-lab-isbh585hyy3sz-iq5wrp15m1nws/playsz-retest-2026-11-12/`. The QA SA already has project roles `cloudtestservice.testAdmin`, `firebase.analyticsViewer`, and `storage.objectAdmin`, but it cannot write to (or even `buckets.get`) the default Test Lab bucket. Creating a replacement bucket failed because the project has no billing account (Spark). **Fix:** grant this SA object-create (and bucket get/list) on the existing Test Lab bucket, or add billing and a results bucket the SA can write to. Then rerun the single Robo matrix above.

2. **P2 — Android home-screen label is `Playsz`, not `Playsz - All In One Player`.** Location: `app/plugins/with-launcher-label.js`; confirmed in the APK and AAB merged manifests (`application android:label="Playsz"`). The full store name is only in `app.json` `expo.name`. If the launcher must show the exact store name, drop or change that plugin and rebuild.

3. **P2 — Preview APK is still a 98.2 MiB universal build (four ABIs).** Production AAB is the store artifact to upload. Keep using the AAB for Play.

4. **Pending (P0-for-submission, known gap)** — `https://krosz.github.io/openplay/terms.html` and `…/privacy.html` 404 until GitHub Pages is hosted. In-app links are already pointed at those URLs. Not a code failure.

5. **Pending (P0-for-submission)** — Sandbox buy, cancel, restore, and unlock persistence were not tested on a device. Do this on a Play license tester after Test Lab (or a human device) can install the preview APK. Robo cannot complete a purchase.

---

No app or repo was edited. `qa-checklist.md` now has a final-gate paywall sandbox section. Screenshots were not collected (`/home/box/shared/screenshots/apps/playsz/testlab/` is empty). This retest does **not** authorise a store submit.
