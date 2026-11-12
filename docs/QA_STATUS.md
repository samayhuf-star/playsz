# QA status — Playsz

Checklist: `/home/box/shared/app-monitor/qa-checklist.md` (set 2026-11-12).

**Gate:** nothing goes to a store without a **PASS** from Testing E2E Bot. PASS = all P0 + P1 pass. P2 is reported, not blocking.

**Repo:** local only, `/workspace/allinone-video-player`, branch `main`. App name (final): Playsz - All In One Player. Android application id and iOS bundle identifier (final): `com.allinone.videoplayer`.

**This is not a PASS.** No Android APK/AAB, no TestFlight or EAS build, no sandbox testers, and no live privacy or support URL have been handed to QA.

Statuses below are based on the real repo state, not on intended product.

| Status | Meaning |
| --- | --- |
| done | Present in the repo and looks complete for that item's code or copy |
| not yet | Missing, incomplete, or not device-verified |
| N/A | Does not apply to this app |

## Hand-off items

| Item | Status | What's needed |
| --- | --- | --- |
| Repo URL + branch/commit | not yet | Local git only; no remote to give QA |
| Bundle ID / package name | done | `com.allinone.videoplayer` in `app/app.json` (final) |
| Android APK or AAB + internal testing link | not yet | EAS project is @krosz/openplay. A pre-rename preview APK from commit `23ecd78` exists (`9ff549bf-45e3-4072-b767-e0932ddcc775`). No post-rename EAS rebuild has been approved. The production profile builds an AAB |
| iOS TestFlight or EAS simulator build | not yet | Same; iOS-on-device stays pending without TestFlight or device evidence |
| Test accounts + sandbox purchase testers | not yet | Store products are not created in the consoles |
| Store listing drafts | done | `docs/STORE_LISTING.md` (Play + App Store). User-facing fields no longer name competitors |
| Privacy policy URL | not yet | Privacy and terms text is accepted as final. In-app links use the planned GitHub Pages URLs (`https://samayhuf-star.github.io/app-legal/playsz/privacy.html` and `.../terms.html`) with `PENDING_HOSTING = true`. Those URLs will 404 until the `site/` pages are hosted. Postal address is a marked placeholder (`Postal address: pending`) and is a blocker before publishing |
| Support URL / email | not yet | Support and grievance contact is listed in `docs/STORE_LISTING.md` and on the `site/` pages (email only, no phone). The planned support/legal URLs will 404 until `site/` is hosted. Copyright holder is Samay Vashsht. The legal-page postal address, and the Google Play developer name and address, remain pending confirmation and must be filled before publishing |

## P0 (blocks)

| # | Item | Status | What's needed |
| --- | --- | --- | --- |
| 1 | No crashes/ANRs (cold start, all screens, background/resume, rotation, offline) | not yet | Library, player, settings, and paywall compile and export, but there is no device or emulator QA pass, and no release binary |
| 2 | No placeholders (lorem, TODO, Test, default Expo icon/splash, example.com, dummy prices) in app or listing | not yet | Default Expo/React artwork and the Big Buck Bunny sample stream are gone. Icons are an original play-button mark. Remaining gaps: Terms/Privacy links use planned GitHub Pages URLs that will 404 until hosted (not example.com); the public legal pages include a clearly marked `Postal address: pending` placeholder that must be replaced before publishing; store products are not live so the paywall shows "unavailable" rather than real prices. Audio export, the private folder, and encrypted export now ship. The display name is the final name, Playsz - All In One Player |
| 3 | Paywall: store-loaded prices, sandbox buy, restore, unlock persists, failed/cancel handled, terms+privacy links, auto-renew disclosure | not yet | Code is in (`expo-iap`, paywall screen, on-device entitlement, restore, cancel/failure handling, auto-renew disclosure, capped extras gated). Prices are store-loaded when the store returns them, otherwise a clear unavailable state. Terms/Privacy links are shown and point at the planned GitHub Pages URLs (they 404 until hosted). Not yet: live console products, a renamed store binary, or a sandbox purchase test |
| 4 | Privacy policy URL live, accurate, linked in app + listing; Play Data safety / Apple privacy labels match SDKs | not yet | Privacy and terms text is accepted as final (`site/privacy.html`, `site/terms.html`). In-app links are shown and point at planned GitHub Pages URLs that will 404 until hosted. Do not publish those pages until the `Postal address: pending` placeholder is replaced with a confirmed address |
| 5 | Minimal permissions with usage strings; no crash on deny | not yet | Video-only usage strings are in `app.json`; the home screen handles deny. A local config plugin marks `SYSTEM_ALERT_WINDOW` (and unused `WRITE_SETTINGS`) with `tools:node="remove"` in the main Android manifest; verified after `npx expo prebuild --platform android --clean`. Debug manifests still declare the overlay permission. The Gradle-merged release manifest could not be generated here (no Java). Not device-tested, including limited-access and iOS deny paths |
| 6 | Both platforms build and run from stated commit | not yet | `npx tsc --noEmit` and `npx expo export --platform android` / `ios` succeed on the post-fix commit. An Android preview APK exists from pre-rename commit `23ecd78`; no post-rename EAS rebuild has been approved. No iOS EAS build has been run |
| 7 | Content rights: no unlicensed video/audio/art/text; no pirated content / DRM claims | done | No bundled sample video or media. Default Expo/React artwork removed. Original icon SVG + rasters in `app/assets`. Store copy and the app do not claim DRM removal or circumvention. Internal notes only discuss competitor lock-in formats |
| 8 | In-app account deletion if sign-up exists | N/A | No sign-up or account system |

## P1 (must fix)

| # | Item | Status | What's needed |
| --- | --- | --- | --- |
| 9 | Icons all sizes (iOS 1024 no alpha, Android adaptive) + splash | done | Original mark rendered by `app/scripts/render-icons.mjs`: `icon.png` is 1024×1024 RGB (no alpha); adaptive background/foreground/monochrome and splash are wired in `app.json`. Still a generated first-party mark, not a later designer brand pass, but the required sizes are present |
| 10 | Screenshots at required sizes from the real build | not yet | Captions are drafted; no screenshots exist, and there is no real store build to capture from |
| 11 | Title/subtitle/description within limits, accurate, no competitor names, correct age rating | not yet | Copy is within limits and competitor names were removed from every user-facing field (they remain only in a clearly marked internal notes section). Age rating is a target (Everyone / 4+) and has not been filed. Some listing claims (4K, EAC3, lock-in-format playback) still need device proof before submit. The name Playsz - All In One Player is final |
| 12 | Version/build bumped + release notes | not yet | Still `1.0.0`. No store release notes |
| 13 | Core flows from first launch work | not yet | First-launch library permission, folders/recents/search/paging, playback, resume, SRT/ASS import, brightness and playback-volume gestures, paywall, real M4A export, and a real private folder are implemented. Not run on a device end-to-end in this renamed build |
| 14 | Friendly offline/slow-network states | not yet | Local playback does not need a network. The paywall has an unavailable-store state. No dedicated slow-network or offline banners on other screens |
| 15 | Layout: small/large phone, tablet, dark mode, large font, safe areas | not yet | `userInterfaceStyle` is automatic and the app follows the system light/dark theme. Safe areas are in the scaffold; `supportsTablet` is on. No pass on small/large phones, tablet, or Dynamic Type |
| 16 | README (setup, env var names, build/release commands, store IDs); no secrets; no debug flags in release | done | Root `README.md` covers setup, EAS (@krosz/openplay), store IDs, paywall, licenses, and the unset legal URLs. No secrets or emails. No known debug flags forced on in release. Env vars: none required yet; legal URLs are source constants, not env |

## P2 (report, not blocking)

| # | Item | Status | What's needed |
| --- | --- | --- | --- |
| 17 | Analytics/crash reporting with consent | N/A | Samay forbids third-party analytics and crash SDKs. Local logs only, nothing uploaded |
| 18 | Accessibility labels, contrast | not yet | No accessibility pass; some contrast is implied by the dark theme but is untested |
| 19 | Startup time, app size, console noise | not yet | Not measured |
| 20 | No ratings prompt on first launch | done | No ratings prompt is implemented, so first launch does not ask for a review |

## Open blockers before a QA hand-off

1. Name and bundle ID are confirmed (Playsz - All In One Player; `com.allinone.videoplayer`).
2. Replace the `Postal address: pending` placeholder on the `site/` privacy, terms, and home pages with a confirmed address (blocker before publishing; do not invent one). Then host those pages at the planned GitHub Pages URLs (`https://samayhuf-star.github.io/app-legal/playsz/…`) and set `PENDING_HOSTING` to false. The in-app links will 404 until that hosting is done. Copyright holder and grievance officer is Samay Vashsht (email only, no phone). Confirm the Google Play developer name and address before store submit.
3. Create the three store products (`playsz_pro_monthly`, `playsz_pro_yearly`, `playsz_pro_lifetime`). The EAS project @krosz/openplay already exists; produce Android and iOS builds from a stated (post-rename) commit for QA.
4. Sandbox-purchase the paywall (buy, cancel, failure, restore, persistence).
5. Capture store screenshots from those builds; file the age rating; drop or prove any unverified playback claims.
6. Hand the builds and listing drafts to Testing E2E Bot and wait for PASS.
