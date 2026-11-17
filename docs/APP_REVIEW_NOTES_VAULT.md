# App Review notes — Dimmer: Private Camera Vault (resubmission after 4.3(a))

Dimmer is a private video vault for iPhone. It is original software by one developer on one account; it is not a template, clone or repackaged app. The vault, M4A audio extraction and AES-GCM encrypted archive are implemented in our own native module (app/modules/playsz-native, Swift).

NO LOGIN, NO DEMO ACCOUNT, NO SAMPLE FILES NEEDED.

HOW TO REACH EVERY FEATURE
1. First launch shows a welcome screen. Tap Get started. Allow Photos access when asked (needed to list and play your videos).
2. Library tab lists videos from Photos. Tap one to play: double-tap or swipe to seek, 1x for speed, Loop, A-B, Subs, PiP, Lock.
3. PRIVATE VAULT: on the Library screen tap the Vault card (or Settings, top right, then Private folder). Authenticate with Face ID or device passcode. Tap Add videos, pick videos, confirm. iOS then shows its own prompt "Allow Dimmer to delete N videos?" — this removes the originals from Photos. Vault videos never appear in Library or Recents.
4. AUDIO EXTRACTION: Settings, Export audio (M4A), choose a video. Free: 3 per day.
5. ENCRYPTED BACKUP (Pro): Settings, Private folder, Export encrypted backup. Set a password; a .playszenc file is shared via the share sheet. Import restores it.
6. PAYWALL: tap Unlock Pro on the Library screen. Restore purchases, Terms and Privacy are on the same screen.

EXTERNAL SERVICES: only Apple In-App Purchase (StoreKit 2). No backend, accounts, analytics, ads or tracking. Face ID data never leaves the device.

SUBSCRIPTIONS: Free includes the player, a vault of up to 10 videos and 3 audio exports a day. Pro lifts those limits and unlocks encrypted backup: monthly and yearly (auto-renewing, 7-day free trial) and lifetime (one-time).

CONTENT AND RIGHTS: the app ships no media and streams nothing. It only handles videos the user already owns.

Contact: Samay Vashsht, samayhuf@gmail.com

## New in Dimmer: private camera
- Vault > Camera (top right, after Face ID unlock): captures photos and videos directly into the app-private vault. Nothing is written to Photos. Camera/microphone are used only while that screen is open.
- Failed-unlock log: when biometric/passcode verification fails, a timestamp is stored on the device and shown at the top of the vault. No photo, location or network use.
- Privacy shield: the app is covered in the app switcher; the vault re-locks on background.
- No hidden or disguised features: no decoy passcode, no alternate app icon.
