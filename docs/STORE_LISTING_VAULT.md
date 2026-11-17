# Dimmer — App Store listing (repositioned after Guideline 4.3(a) rejection)

Supersedes the iOS parts of STORE_LISTING.md. Every claim below is implemented in the current build. No MKV, 4K, Dolby/EAC3, streaming or AI-subtitle claims, and no competitor names.

**Name (App Store Connect, 30 max):** Dimmer: Private Camera Vault
**Subtitle (30 max):** Face ID video vault
**Promotional text (170 max):** Hide private videos behind Face ID, pull the audio out of any video, and back up your vault as an encrypted file. No ads, no account, no cloud.
**Keywords (100 max):** private,vault,hide videos,face id,lock,secure,audio extractor,m4a,encrypted backup,subtitles

## Description

Dimmer keeps your private videos private.

PRIVATE VAULT
Move videos out of your Photos library into a vault that opens only with Face ID or your passcode. Vault videos never appear in your library or in Recents.

AUDIO EXTRACTION
Turn any video into an M4A audio file on your device.

ENCRYPTED BACKUP
Export your vault as a password-protected, AES-GCM encrypted file and keep it wherever you choose. Import it on another device.

A PLAYER THAT STAYS OUT OF THE WAY
Resume where you left off, swipe to seek, adjust brightness and volume, change speed, picture-in-picture, background audio, and subtitle files (SRT/ASS) with sync saved per video.

PRIVATE BY DESIGN
No ads, no account, no analytics, no cloud. Your videos and settings stay on your device.

PLAYSZ VAULT PRO
Free: a player plus a vault for up to 10 videos and 3 audio exports a day. Pro lifts those limits and unlocks encrypted backup. Monthly, yearly and lifetime options; manage or cancel in your Apple ID settings.

## Screenshot order (each must show a real build screen)
1. Vault card + Face ID prompt
2. Vault contents
3. Audio extraction
4. Encrypted export
5. Player with gestures and subtitles
6. Pro paywall

## App Review notes
Dimmer plays videos from the user's own Photos library and a Face ID-protected on-device vault. It uses Apple frameworks only for playback (AVPlayer). It is not a template or repackaged app; its vault, M4A export and encrypted archive features are implemented in a custom native module (app/modules/playsz-native).

## Before resubmission
- Rename the app in App Store Connect to match the name above.
- Replace screenshots with ones from this build.
- Samay must confirm before anything is submitted.
