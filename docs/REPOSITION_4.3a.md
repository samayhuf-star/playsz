# Playsz — repositioning for App Store Guideline 4.3(a) Spam

**Rejection (16 Nov 2026):** Guideline 4.3(a) Design - Spam — too similar in binary, metadata or concept to other developers' apps. The app was presented as a generic "offline video player with no ads," a category with thousands of near-identical apps (PLAYit etc.). The genuinely distinct feature — a Face ID–locked private video vault — was buried as a Pro extra with no entry on the home screen.

**Fix direction (Samay, 25 Nov):** reposition as a **private video vault** with distinct content and functionality (keep the existing vault code, which already does Face ID lock + on-device encrypted storage + export).

## Code changes (branch `feat/playsz-private-vault`)
- `app.json`: name `Playsz - All In One Player` → **`Playsz: Private Video Vault`**; description rewritten vault-first.
- `src/app/index.tsx`: added a prominent, always-visible **Private Vault** card at the top of the home screen → routes to `/private-folder` (which self-locks via Face ID / passcode). Tagline reframed to lead with the vault.
- `src/app/_layout.tsx`: private-folder screen title → "Private Vault".
- The vault, lock, import and encrypted-export code already existed (`private-folder.tsx`, `private-lock.ts`, `vault-export.ts`); this change makes it the app's primary identity rather than a hidden feature.
- Nothing claimed that the app doesn't do (Face ID lock, on-device encrypted vault, offline playback of your own files, no ads — all already implemented). No false metadata.

## New App Store copy (paste into ASC when submitting; keep draft until GO_AHEAD)
- **Name (≤30):** `Playsz: Private Video Vault` (27)
- **Subtitle (≤30):** `Hide videos behind Face ID` (26)
- **Promotional text / description lead:**
  > Playsz is a private video vault. Move personal videos into an on-device vault locked by Face ID (with a passcode fallback), where they stay encrypted and never appear in your normal library or leave the phone. The vault includes a clean, ad-free player so you can watch what you've hidden, and an encrypted export you control. No ads, no account, no cloud, no analytics.
- **Keywords:** private video vault, hide videos, face id lock, secret video, photo video locker, private folder, app lock, encrypted vault, offline player
- Keep the "what Playsz is not" honesty section; drop "all in one player" / generic "offline video player" as the lead.

## Resolution Center reply — DRAFT for Samay to post (do NOT resubmit until he posts this and gives go-ahead)
> Thank you for the review. We agree the previous version read like a generic offline video player. We have repositioned the app around its distinct purpose: a **private video vault**. Users move personal videos into an on-device vault that is locked by Face ID / Touch ID (passcode fallback), kept in app-private encrypted storage, hidden from the normal library, and exportable only by the owner as an encrypted archive — functionality a standard media player does not provide. We have updated the app name, icon framing, screenshots and description to make this the primary experience, and surfaced the vault as the first thing on the home screen. We believe this makes the app's concept and metadata distinct. Happy to make further changes you suggest.

## Still needed from Samay
- Post the Resolution Center reply above.
- New screenshots that lead with the vault (the old screenshots show the generic library).
- A real-iPhone recording + `GO_AHEAD.md` entry before any resubmission.
