#!/usr/bin/env bash
# Playsz flow for the public sim-qa runner, modelled on klenzer-simqa/qa/sim-qa/flow.sh.
# Env from the workflow: UDID, BUNDLE_ID, SCHEME, WORKSPACE, DERIVED_DATA, OUT.
# Installs the Release .app, seeds a local test video, then drives Maestro:
# launch, play a seeded video, paywall prices and 7-day trial copy, Restore,
# and a StoreKit test purchase when products load. Screenshots land in $OUT.
# This script does not start a CI run, EAS build, or App Store Connect write.
set -euo pipefail
: "${UDID:?}" "${BUNDLE_ID:?}" "${SCHEME:?}" "${DERIVED_DATA:?}" "${OUT:?}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
mkdir -p "$OUT/screenshots" "$OUT/maestro"
export QA_ARTIFACTS="$OUT"
export QA_MEDIA_DIR="${QA_MEDIA_DIR:-$OUT/media}"
export BUNDLE_ID
export QA_COMMIT="${QA_COMMIT:-$(git rev-parse HEAD)}"
export QA_STARTED_AT="${QA_STARTED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
export QA_SIMULATOR="${QA_SIMULATOR:-$UDID}"

echo "==> Boot simulator $UDID"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
# Prefer the requested device when more than one simulator is booted.
export SIMCTL_CHILD_UDID="$UDID"

echo "==> Locate .app"
APP="$(find "$DERIVED_DATA/Build/Products" -path '*iphonesimulator/*.app' -maxdepth 3 | head -n1 || true)"
if [[ -z "$APP" ]]; then
  APP="$(find "$DERIVED_DATA/Build/Products" -name "$SCHEME.app" | head -n1 || true)"
fi
if [[ -z "$APP" ]]; then
  echo "No .app found under $DERIVED_DATA/Build/Products" | tee "$OUT/flow-error.txt"
  exit 1
fi
echo "app: $APP"

echo "==> Generate and seed test media"
if command -v ffmpeg >/dev/null 2>&1; then
  "$ROOT/scripts/ios-sim-qa/generate-media.sh" "$QA_MEDIA_DIR"
else
  echo "ffmpeg not on PATH; media generation skipped" | tee -a "$OUT/seed.txt"
fi

echo "==> Install and grant Photos"
xcrun simctl install "$UDID" "$APP"
xcrun simctl privacy "$UDID" grant photos "$BUNDLE_ID" || true
xcrun simctl privacy "$UDID" grant photos-add "$BUNDLE_ID" || true
if [[ -f "$QA_MEDIA_DIR/manifest.json" ]]; then
  # seed-media.sh talks to the booted device; only this UDID should be booted.
  "$ROOT/scripts/ios-sim-qa/seed-media.sh" | tee -a "$OUT/seed.txt"
else
  echo "No media manifest; play step will be skipped" | tee -a "$OUT/seed.txt"
fi

shot() {
  local name="$1"
  xcrun simctl io "$UDID" screenshot "$OUT/screenshots/${name}.png" >/dev/null
  echo "screenshot: $OUT/screenshots/${name}.png"
}

if ! command -v maestro >/dev/null 2>&1; then
  echo "==> Install Maestro"
  curl -Ls "https://get.maestro.mobile.dev" | bash
  export PATH="$HOME/.maestro/bin:$PATH"
fi
command -v maestro >/dev/null 2>&1 || { echo "maestro is not on PATH" | tee "$OUT/flow-error.txt"; exit 1; }

echo "==> Launch and screenshot"
xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
sleep 3
shot "01-launch"

echo "==> Maestro QA flow (launch, play, paywall, trial copy, purchase, Restore)"
set +e
python3 "$ROOT/scripts/ios-sim-qa/run-qa.py"
RC=$?
set -e

# Capture screenshots of the key states even if a later Maestro step failed.
# Re-open the paywall for a still of prices / trial copy / chrome when possible.
if command -v maestro >/dev/null 2>&1; then
  maestro test "$ROOT/.maestro/05_paywall_open.yaml" >/dev/null 2>&1 && shot "03-paywall" || true
  maestro test "$ROOT/.maestro/05_paywall_screenshot.yaml" >/dev/null 2>&1 || true
fi

# A playing-video still: best-effort after the library is showing a seeded clip.
if [[ -f "$OUT/screenshots/02-playing.png" ]]; then
  true
else
  # run-qa may have left the player open; grab whatever is on screen.
  shot "02-current"
fi

# Prefer renaming current screen shots if the player or paywall is already captured by Maestro debug output.
if [[ -d "$OUT/maestro" ]]; then
  find "$OUT/maestro" -type f \( -name '*.png' -o -name '*.jpg' \) -print | head
fi

# If run-qa wrote results, keep them. Always write a short summary pointer.
if [[ -f "$OUT/results.json" ]]; then
  echo "results: $OUT/results.json"
else
  echo "run-qa.py did not write results.json (exit $RC)" | tee "$OUT/flow-error.txt"
fi
if [[ -f "$OUT/summary.md" ]]; then
  cat "$OUT/summary.md"
fi

# Final still of whatever is on screen (Restore / purchase result, or the home library).
shot "04-final"
exit $RC
