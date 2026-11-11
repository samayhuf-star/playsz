# Store listings draft — OpenPlay

**Working title: OpenPlay.** This name is pending Samay's approval and must be cleared (trademark + store uniqueness) before submit. Identifiers (proposal): `com.allinone.videoplayer` on Android (application id) and iOS (bundle identifier). Category: Video Players & Editors / Photo & Video. Content rating target: PEGI 3 / Everyone / 4+ (no game hall, no user-generated feed). Default language: English (US), with HI, ID, AR listings after copy approval.

Android and iOS **launch together**. This file holds the Play Store draft and the App Store draft.

This is launch copy for the **MVP**. Do not submit claims about on-device AI subtitles, SMB/DLNA streaming, or Android TV until those features ship. Verify 4K, EAC3/Dolby, Bluetooth queue, and PLAYit/VidMate file playback on real Android and iOS devices before using those lines.

The app has **no ads**, **no third-party APIs**, and **no backend**. Do not mention Chromecast, cloud backup, OpenSubtitles, or "remove ads" as a Pro benefit.

---

## Google Play Store

### Title (30/30 characters)

```
OpenPlay: Ad-Free Video Player
```

Character count: 30 (limit 30). If the name changes, keep the "Ad-Free Video Player" promise and stay at or under 30 characters. Do not use "All in One Video Player" in the title.

### Short description (71/80 characters)

```
No ads, ever. Standard files, 4K-ready player, one-time or monthly Pro.
```

Character count: 71 (limit 80).

### Full description (2781/4,000 characters)

```
OpenPlay is the offline video player that never interrupts your video — and never shows an ad.

NO ADS, ANYWHERE
Pause, resume, skip to the next file, play offline, or listen in the background. There is no ad on the player, no "take a break" screen, and no banner in your library. OpenPlay makes money only from an optional Pro upgrade, never from advertising.

YOUR FILES STAY YOURS
Every file you save or export is a standard format such as MP4, MKV, or MP3, so it plays in other apps. No lock-in and no hidden containers. OpenPlay can also play many videos that other apps refuse, including files saved by PLAYit or VidMate, where the format allows, and can help you convert your own files to a standard format.

PLAYS THE FORMATS YOU ACTUALLY HAVE
MKV, MP4, AVI, WebM, FLV, TS, MOV, 3GP and more. Built to play 4K smoothly on capable devices and to handle audio tracks other players drop, including EAC3 and other Dolby formats. Resume exactly where you left off. Playlists keep going, including over Bluetooth and after a call.

GESTURES YOU ALREADY KNOW
Swipe to seek, adjust volume or brightness, and double-tap to skip — the same muscle memory as MX Player and VLC. Playback speed from 0.25x to 4x, screen lock, picture-in-picture, background play, video-to-MP3, and subtitle files you add yourself, with sync saved per video.

BUILT FOR PRIVACY
OpenPlay asks for access to your videos so it can play them. It does not ask for location, camera, or a list of running apps. Picture-in-picture is requested only if you turn it on. There is no account to create, no cloud, and no analytics service. Your playback position and preferences stay on the device. You can delete in-app data from Settings. The private folder is built so hidden files cannot silently disappear, with a recovery path and a local encrypted export you control.

SIMPLE, HONEST PRICING
The player is free. Optional OpenPlay Pro is $2.99 per month, $9.99 per year, or $29.99 once for life (prices may vary by country). Pro lifts caps on extras such as video-to-MP3 exports and the private folder, and unlocks local encrypted backup export plus later on-device extras as they ship. Trials show the price up front and remind you before any charge. Restore purchases at any time. Purchases go through Google Play or the App Store only.

WHAT OPENPLAY IS NOT
OpenPlay does not include a YouTube or social-video downloader. It does not bundle a game hall or a content feed. It does not use third-party cloud or advertising services. It is a player for videos already on your phone and, in a later update, on your own home network over open protocols (SMB, DLNA).

OpenPlay launches on Android and iOS together.

If something breaks, rate honestly and tell us in a review — we read and reply to critical reviews.
```

Character count: 2781 (limit 4,000).

### Keyword and ASO notes (Play)

- Primary promise: "ad free video player", "video player without ads", "offline video player", "MKV player", "4K video player".
- Secondary: "EAC3 player", "Dolby audio player", "MP4 to MP3", "floating video player", "background play", "private folder video", "subtitle player Hindi".
- Regional listings (not stuffed into the English title): Hindi, Bahasa, and Arabic equivalents of "video player without ads" / "offline video player".
- Do not lead with AI photo-to-video or "all in one video player" — that is PLAYit's title phrase and current pivot. Win on uninterrupted playback, no ads, and standard files.
- Short promo video: a single take of a video being paused, resumed, and skipped, with no ad. That contrast is the listing's job.
- Update cadence after launch: every 2–4 weeks, with real changelog notes (not only "bug fixes").
- Review prompt: ask after a completed playback, never intercept the player, never ask for 5 stars specifically.

### Play screenshot captions

1. No ads — not during playback, not in your library.
2. Your library. Standard files you can open anywhere.
3. 4K-ready, with audio tracks other players drop.
4. Gestures you already know from MX Player and VLC.
5. Resume where you left off. Playlists that actually continue.
6. A private folder with a recovery path — files don't vanish.
7. Can't open a PLAYit or VidMate file? OpenPlay can try.
8. Optional Pro: $2.99/month, $9.99/year, or $29.99 once.

Use dark-UI screenshots on mid-range Android and current iPhone frames. Show a real library and a mid-playback screen with no ad units. Screenshot 7 should only be used after Smart Muxer playback is verified.

### Play Data safety answers (draft)

Complete against the final binary. Values below assume MVP as specified: no ad SDK, no analytics/crash SaaS, no backend, no cloud, purchases only via Google Play Billing, entitlements stored on-device.

**Does the app collect or share user data?** No. OpenPlay does not collect user data. Purchases are processed by Google Play, not by our servers (there are none). Playback position, preferences, and entitlement flags stay on the device. Local logs are not uploaded.

Proposed Data safety entries:

| Data type | Collected? | Shared? | Purpose |
| --- | --- | --- | --- |
| Location, personal info, financial info, health, messages, photos and videos (uploaded), audio files (uploaded), files and docs (uploaded), calendar, contacts, app activity, web browsing, app info and performance (uploaded), device or other IDs | No | No | — |
| Photos and videos on-device | The app reads local videos on the device in order to play them. It does not upload them. | No | App functionality (on-device only) |
| Purchases | Handled by Google Play. The app stores an on-device entitlement flag after a successful store purchase or restore. That flag is not sent to us. | No (none of ours; Google Play is the store) | App functionality |

**Security practices (draft answers):**

- Data is encrypted in transit: not applicable for app-collected data (none). Store checkout uses Google Play's transport.
- Data encrypted at rest: follow device encryption; private-folder files and local encrypted exports are encrypted on device.
- Users can request that data be deleted: **Yes**, because it lives on the device. Settings > Delete my data clears preferences, resume positions, entitlement cache (restore will recover Pro), and local logs. This contrasts with PLAYit, whose Data safety form says data cannot be deleted.
- Independent security review: No (unless we later commission one).
- Not a children's-directed app; do not target children.

**Permissions to declare and justify:**

- `READ_MEDIA_VIDEO` / storage (legacy): play videos stored on the device. Request video-only granular access on Android 13+. Do not request broad photo access.
- Notifications (optional): trial-ending reminder and export completion, requested only when that feature is used.
- `FOREGROUND_SERVICE` / media playback: background audio.
- Picture-in-picture: only after the user enables popup play.
- Internet: required by the OS for Play Billing restore and for the user to reach the store. The player itself works fully offline. No analytics, ads, or account calls.
- Do **not** request location, camera, contacts, query all packages, or modify system settings.

The privacy policy URL and developer legal name must be live before store submit. Those values are owned by Samay and are listed as open questions in the handoff, not as blanks inside this listing copy. Do not put contact emails in this repository.

---

## Apple App Store

### Name (30/30 characters)

```
OpenPlay: Ad-Free Video Player
```

Character count: 30 (limit 30).

### Subtitle (27/30 characters)

```
Never interrupts your video
```

Character count: 27 (limit 30).

### Promotional text (161/170 characters)

```
The offline video player with no ads at all. Pause, resume, and skip in peace. Standard files, no lock-in. Optional Pro: $2.99/month, $9.99/year, or $29.99 once.
```

Character count: 161 (limit 170). Promotional text can be updated without a new binary.

### Description (2781/4,000 characters)

```
OpenPlay is the offline video player that never interrupts your video — and never shows an ad.

NO ADS, ANYWHERE
Pause, resume, skip to the next file, play offline, or listen in the background. There is no ad on the player, no "take a break" screen, and no banner in your library. OpenPlay makes money only from an optional Pro upgrade, never from advertising.

YOUR FILES STAY YOURS
Every file you save or export is a standard format such as MP4, MKV, or MP3, so it plays in other apps. No lock-in and no hidden containers. OpenPlay can also play many videos that other apps refuse, including files saved by PLAYit or VidMate, where the format allows, and can help you convert your own files to a standard format.

PLAYS THE FORMATS YOU ACTUALLY HAVE
MKV, MP4, AVI, WebM, FLV, TS, MOV, 3GP and more. Built to play 4K smoothly on capable devices and to handle audio tracks other players drop, including EAC3 and other Dolby formats. Resume exactly where you left off. Playlists keep going, including over Bluetooth and after a call.

GESTURES YOU ALREADY KNOW
Swipe to seek, adjust volume or brightness, and double-tap to skip — the same muscle memory as MX Player and VLC. Playback speed from 0.25x to 4x, screen lock, picture-in-picture, background play, video-to-MP3, and subtitle files you add yourself, with sync saved per video.

BUILT FOR PRIVACY
OpenPlay asks for access to your videos so it can play them. It does not ask for location, camera, or a list of running apps. Picture-in-picture is requested only if you turn it on. There is no account to create, no cloud, and no analytics service. Your playback position and preferences stay on the device. You can delete in-app data from Settings. The private folder is built so hidden files cannot silently disappear, with a recovery path and a local encrypted export you control.

SIMPLE, HONEST PRICING
The player is free. Optional OpenPlay Pro is $2.99 per month, $9.99 per year, or $29.99 once for life (prices may vary by country). Pro lifts caps on extras such as video-to-MP3 exports and the private folder, and unlocks local encrypted backup export plus later on-device extras as they ship. Trials show the price up front and remind you before any charge. Restore purchases at any time. Purchases go through Google Play or the App Store only.

WHAT OPENPLAY IS NOT
OpenPlay does not include a YouTube or social-video downloader. It does not bundle a game hall or a content feed. It does not use third-party cloud or advertising services. It is a player for videos already on your phone and, in a later update, on your own home network over open protocols (SMB, DLNA).

OpenPlay launches on Android and iOS together.

If something breaks, rate honestly and tell us in a review — we read and reply to critical reviews.
```

Character count: 2781 (limit 4,000). Same story as Play, including the line that OpenPlay launches on Android and iOS together.

### Keywords (79/100 characters)

```
offline,mkv,mp4,avi,webm,4k,eac3,dolby,subtitle,background,pip,folder,music,ios
```

Character count: 79 (limit 100). Comma-separated, no spaces after commas. Words already in the name or subtitle (OpenPlay, ad-free, video, player, never, interrupts) are omitted so the 100-character budget is not wasted.

### App Store screenshot captions

Use the same eight captions as Play, framed on current iPhones (6.7" and 6.1") and, if we support tablet layouts, iPad. Do not show Android chrome in the iOS listing.

### Privacy Nutrition Label (draft)

Apple's labels should match the binary. For this product, the intended answer is that OpenPlay does **not collect data**.

**Data Used to Track You:** None. There is no advertising SDK and no tracking.

**Data Linked to You:** None.

**Data Not Linked to You:** None collected by us.

**Data Not Collected:** Select this if the submitted binary still has no analytics, no crash uploader, no account, no cloud, and no ad identifier access.

Notes for App Review (not shown on the nutrition label):

- In-app purchases are sold through StoreKit. Apple processes the payment. The app keeps an on-device entitlement; it does not send receipts to our server (there is no server).
- Photo Library access is for playing videos already on the device (purpose string is set in `app.json`). We do not upload the library.
- Background audio uses the standard audio background mode.
- If a future build introduces on-device model packs, those files stay on the device and still are not collected.

App Privacy policy URL, support URL, and the legal entity name are required at submit time and are owned by Samay (open questions in the handoff). Do not store emails or secrets in this repo.
