# QA status — OpenPlay

Checklist: `/home/box/shared/app-monitor/qa-checklist.md` (set 2026-11-12).

**Gate:** nothing goes to a store without a **PASS** from Testing E2E Bot. PASS = all P0 + P1 pass. P2 is reported, not blocking.

**Repo:** local only, `/workspace/allinone-video-player`, branch `main`. Identifiers (proposal): `com.allinone.videoplayer`. Working title OpenPlay is still waiting for Samay's approval.

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
| Bundle ID / package name | done | `com.allinone.videoplayer` in `app/app.json` (proposal, pending confirmation) |
| Android APK or AAB + internal testing link | not yet | EAS project is not created; no `eas build` has been run |
| iOS TestFlight or EAS simulator build | not yet | Same; iOS-on-device stays pending without TestFlight or device evidence |
| Test accounts + sandbox purchase testers | not yet | Store products are not created in the consoles |
| Store listing drafts | done | `docs/STORE_LISTING.md` (Play + App Store). User-facing fields no longer name competitors |
| Privacy policy URL | not yet | Pages exist in `site/privacy.html` (publisher: Sunny Vashisht). Not hosted yet, so `LEGAL_URLS` is still unset |
| Support URL / email | not yet | Support contact is listed in `docs/STORE_LISTING.md` and on the `site/` pages. Support URL is pending hosting of `site/`. Play developer name and address, and the copyright holder, remain pending confirmation |

## P0 (blocks)

| # | Item | Status | What's needed |
| --- | --- | --- | --- |
| 1 | No crashes/ANRs (cold start, all screens, background/resume, rotation, offline) | not yet | Library, player, settings, and paywall compile and export, but there is no device or emulator QA pass, and no release binary |
| 2 | No placeholders (lorem, TODO, Test, default Expo icon/splash, example.com, dummy prices) in app or listing | not yet | Default Expo/React artwork and the Big Buck Bunny sample stream are gone. Icons are an original play-button mark. Remaining gaps: the display name is still a working title; Terms/Privacy URLs are unset (not pointed at example.com); store products are not live so the paywall shows "unavailable" rather than real prices; Settings export/folder actions are cap-gates only, the real encoder and vault are not built |
| 3 | Paywall: store-loaded prices, sandbox buy, restore, unlock persists, failed/cancel handled, terms+privacy links, auto-renew disclosure | not yet | Code is in (`expo-iap`, paywall screen, on-device entitlement, restore, cancel/failure handling, auto-renew disclosure, capped extras gated). Prices are store-loaded when the store returns them, otherwise a clear unavailable state. Terms/Privacy links only render when `LEGAL_URLS` is set. Not yet: live console products, a dev-client/store binary, or a sandbox purchase test |
| 4 | Privacy policy URL live, accurate, linked in app + listing; Play Data safety / Apple privacy labels match SDKs | not yet | Policy text and store contact fields are drafted (`site/privacy.html`, `docs/STORE_LISTING.md`). The policy is not hosted at a live URL yet, so the in-app links stay hidden |
| 5 | Minimal permissions with usage strings; no crash on deny | not yet | Video-only usage strings are in `app.json`; the home screen handles deny. Not device-tested, including limited-access and iOS deny paths |
| 6 | Both platforms build and run from stated commit | not yet | `npx tsc --noEmit` and `npx expo export --platform android` / `ios` succeed. No native EAS/Xcode/Gradle installable build has been produced |
| 7 | Content rights: no unlicensed video/audio/art/text; no pirated content / DRM claims | done | No bundled sample video or media. Default Expo/React artwork removed. Original icon SVG + rasters in `app/assets`. Store copy and the app do not claim DRM removal or circumvention. Internal notes only discuss competitor lock-in formats |
| 8 | In-app account deletion if sign-up exists | N/A | No sign-up or account system |

## P1 (must fix)

| # | Item | Status | What's needed |
| --- | --- | --- | --- |
| 9 | Icons all sizes (iOS 1024 no alpha, Android adaptive) + splash | done | Original mark rendered by `app/scripts/render-icons.mjs`: `icon.png` is 1024×1024 RGB (no alpha); adaptive background/foreground/monochrome and splash are wired in `app.json`. Still a generated first-party mark, not a later designer brand pass, but the required sizes are present |
| 10 | Screenshots at required sizes from the real build | not yet | Captions are drafted; no screenshots exist, and there is no real store build to capture from |
| 11 | Title/subtitle/description within limits, accurate, no competitor names, correct age rating | not yet | Copy is within limits and competitor names were removed from every user-facing field (they remain only in a clearly marked internal notes section). Age rating is a target (Everyone / 4+) and has not been filed. Some listing claims (4K, EAC3, lock-in-format playback) still need device proof before submit. Name pending approval |
| 12 | Version/build bumped + release notes | not yet | Still `1.0.0`. No store release notes |
| 13 | Core flows from first launch work | not yet | First-launch library permission, playback, resume, paywall, and cap gates are implemented in the scaffold. Not run on a device end-to-end |
| 14 | Friendly offline/slow-network states | not yet | Local playback does not need a network. The paywall has an unavailable-store state. No dedicated slow-network or offline banners on other screens |
| 15 | Layout: small/large phone, tablet, dark mode, large font, safe areas | not yet | Dark UI and safe areas are in the scaffold; `supportsTablet` is on. No pass on small/large phones, tablet, or Dynamic Type |
| 16 | README (setup, env var names, build/release commands, store IDs); no secrets; no debug flags in release | done | Root `README.md` covers setup, EAS (project not created), store IDs, paywall, licenses, and the unset legal URLs. No secrets or emails. No known debug flags forced on in release. Env vars: none required yet; legal URLs are source constants, not env |

## P2 (report, not blocking)

| # | Item | Status | What's needed |
| --- | --- | --- | --- |
| 17 | Analytics/crash reporting with consent | N/A | Samay forbids third-party analytics and crash SDKs. Local logs only, nothing uploaded |
| 18 | Accessibility labels, contrast | not yet | No accessibility pass; some contrast is implied by the dark theme but is untested |
| 19 | Startup time, app size, console noise | not yet | Not measured |
| 20 | No ratings prompt on first launch | done | No ratings prompt is implemented, so first launch does not ask for a review |

## Open blockers before a QA hand-off

1. Confirm the name and bundle ID.
2. Host the `site/` privacy and terms pages at a live URL, then set `LEGAL_URLS` in `app/src/constants/legal.ts`. Confirm the copyright holder and the Google Play developer name and address before store submit.
3. Create the three store products and an EAS project on the krosz account; produce Android and iOS builds from a stated commit.
4. Sandbox-purchase the paywall (buy, cancel, failure, restore, persistence).
5. Capture store screenshots from those builds; file the age rating; drop or prove any unverified playback claims.
6. Hand the builds and listing drafts to Testing E2E Bot and wait for PASS.
