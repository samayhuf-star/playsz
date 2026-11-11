# Paywall plan — Playsz

**App name (final):** Playsz - All In One Player. Android application id and iOS bundle identifier (final): `com.allinone.videoplayer`.

**USD prices are final:** $2.99 a month, $9.99 a year, $29.99 lifetime. Regional prices below are **suggestions only** for store pricing templates; they have not been tested.

**Hard constraint:** no third-party APIs and no paid services. No RevenueCat, no ad networks, no billing backend, no cloud entitlements. Revenue is subscriptions and lifetime only.

## Principles

- The player is complete for free. Playback quality is never paywalled.
- **No ads in any tier**, including pause, resume, seek, next/previous, exit, offline, background audio, and the library.
- Free includes a **capped set of extras**. Pro unlocks the rest (uncapped extras and Pro-only features as they ship).
- Pro is sold as monthly, yearly, or a one-time lifetime purchase. Lifetime is always available; Pro is never subscription-only.
- Trials are opt-in, priced in the clear, and reminded before a charge. Restore purchases is always visible.
- Paywalls never appear on the player surface.
- Purchases go only through **Google Play Billing** and **Apple StoreKit**, via an open-source on-device library. Entitlements are checked on the device.

## Free vs Pro matrix

There is no ad-removal row: there are no ads.

| Capability | Free | Pro (monthly, yearly, or lifetime) |
| --- | --- | --- |
| Local library, folders, recents, search | Yes | Yes |
| Playback of supported formats, 4K/EAC3 as the engine allows | Yes | Yes |
| Resume position, playlists, Bluetooth continuation | Yes | Yes |
| Gestures, speed control, screen lock | Yes | Yes |
| Embedded subtitles, local SRT/ASS, manual import, per-file sync | Yes | Yes |
| Online subtitle APIs (OpenSubtitles or similar) | Not offered | Not offered |
| Background audio play | Yes | Yes |
| Picture-in-picture / popup player | Yes | Yes |
| Video-to-MP3 and other standard-format exports | Capped (3 successful exports per day) | Unlimited |
| Play PLAYit/VidMate files where supported; convert own files to MP4/MKV | Yes | Yes |
| Private folder with recovery key (local) | Capped (10 items) | Unlimited |
| Local encrypted export/import of the private folder | No | Yes |
| Cloud backup | Not offered | Not offered |
| On-device AI subtitles and translation (v2, whisper.cpp or similar OSS) | No | Yes, when shipped |
| SMB and DLNA/UPnP streaming (v2, open-source implementation only) | No | Yes, when shipped |
| Google Cast / vendor cast SDKs | Not offered | Not offered |
| Equalizer / advanced audio UX | Basic | Full, when shipped |

If a v2 row has not shipped, it must not appear on the live paywall. The paywall should only sell features that work today.

## Price points

USD is final. Other currencies are suggestions to seed Play / App Store pricing templates and must be reviewed before submit.

| SKU (final) | USD (final) | India INR (suggestion) | Indonesia IDR (suggestion) | Philippines PHP (suggestion) | UAE AED (suggestion) | Saudi SAR (suggestion) |
| --- | --- | --- | --- | --- | --- | --- |
| `playsz_pro_monthly` | **$2.99** / month | ₹299 / month | Rp49,000 / month | ₱179 / month | AED 10.99 / month | SAR 10.99 / month |
| `playsz_pro_yearly` | **$9.99** / year | ₹999 / year | Rp165,000 / year | ₱579 / year | AED 36.99 / year | SAR 37.99 / year |
| `playsz_pro_lifetime` | **$29.99** once | ₹2,499 once | Rp499,000 once | ₱1,749 once | AED 109.99 once | SAR 112.99 once |

Lifetime pays for itself versus yearly after three years at the USD list prices. Monthly matches a familiar competitor price; yearly is the habitual plan; lifetime is the "best value" plan.

Use the same product ids on Play and App Store where the stores allow it. Create the products in each store console; do not use a third-party product catalog.

## Entitlements

One entitlement: `pro`. Monthly, yearly, and lifetime all grant `pro` while valid. Monthly and yearly follow store auto-renewal and end when the store says they have ended. Lifetime never expires.

A user who buys yearly or monthly and later lifetime should be treated as `pro` for life; do not stack charges. Cross-grade rules follow each store's own subscription groups and a single lifetime non-consumable (or non-renewing equivalent). There is no account to merge purchases across a Play device and an iPhone — each store's purchase restores on that store's platform. Do not add a login system to sync entitlements (that would need a backend).

Entitlement checks:

- Ask Play Billing or StoreKit 2 for current purchases / renewal state on launch, on foreground, and on Restore.
- Cache the result in on-device storage (AsyncStorage or encrypted platform storage).
- Trust the store APIs. There is no receipt-validation server. Jailbreak/root tampering is an accepted risk.
- A visible **Restore purchases** button lives on the paywall and in Settings.

## Paywall triggers

Show the paywall **off the player screen only**:

1. **Settings → Unlock Pro** (always available, with Restore).
2. **User hits a cap or taps a Pro feature** (fourth export of the day, 11th private-folder item, encrypted export, later AI subtitles or SMB/DLNA). Explain the cap or feature, then the paywall.
3. **Soft prompt after 3 completed playbacks**, once per session, dismissible for 7 days. Never mid-video, never on first launch, never as a blocking gate to the library.

Do not: auto-start a trial, put a paywall behind play, interrupt pause/resume, or require an account to buy.

## Trial rules

- Trial applies to the **yearly** SKU only, not to lifetime, and not to monthly at launch.
- Length: **7 days**, opt-in. The user must tap a clearly labeled "Start 7-day free trial" that also shows the post-trial price and renewal ("Then $9.99/year, cancel anytime"; localize the amount).
- Do not start a trial on app open, on an accidental tap, or as the default selected plan. Default selected plan on the paywall is **yearly**, with lifetime marked "Best value."
- **Reminder 24 hours before first charge** using a local notification (permission requested at trial start) and an in-app banner if notifications were denied. This is a hard product rule after PLAYit reviews about surprise trial charges.
- Cancel any time during the trial from a paywall link to the store's subscription management screen, explained in one sentence.
- If the OS cannot reliably schedule the 24-hour reminder, do not offer a trial until that reminder ships.
- No dark patterns: no pre-checked boxes, no hidden auto-renew text, no "continue" that means "subscribe."

## Ad placement rules

There are **no ads** and **no ad SDKs** in any build, free or Pro. Do not add rewarded ads, banners, interstitials, or "watch an ad to lift a cap." Caps are lifted only by Pro.

## Billing recommendation: store billing only, on-device

**Use Google Play Billing on Android and Apple StoreKit on iOS**, which both stores require for digital goods, through an open-source on-device library such as **expo-iap** or **react-native-iap** (MIT). Prefer the library that is current with Expo SDK 58 when IAP is implemented.

Why this, and not RevenueCat or a backend:

- Samay's rule: no third-party APIs and no paid services. RevenueCat is a paid third-party API and is not allowed.
- There is no server to host receipt validation, webhook processing, or cross-platform identity.
- Restore purchases, subscription status, and lifetime unlock are all available from the official store APIs on the device.
- Price experiments, if any, are done by changing store listings and shipping a new paywall layout, not via a remote paywall service.

Implementation notes:

- Product ids (final): `playsz_pro_monthly`, `playsz_pro_yearly`, `playsz_pro_lifetime`.
- iOS: StoreKit 2, a subscription group for monthly/yearly, and a non-consumable (or equivalent) for lifetime. Follow Apple's offer codes and tax settings in App Store Connect — no third-party commerce tool.
- Android: Play Billing one-time product for lifetime and auto-renewing subscriptions for monthly/yearly, in a single base plan group as Play requires.
- Do not build or submit with placeholder SKUs that are not created in the consoles. The EAS project already exists (@krosz/openplay); do not start a paid store listing until the hosted privacy policy and trial reminder are real.
- expo-iap is integrated in the scaffold. Create the three product ids in Play Console and App Store Connect before a sandbox purchase test.
