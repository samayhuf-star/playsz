#!/usr/bin/env bash
# Playsz prepare step for the public sim-qa runner (after expo prebuild / pod install, before the build).
# Copies app/ios-storekit/Playsz.storekit into the generated ios/ folder and points every shared
# Xcode scheme's Run and Test actions at it, so StoreKit Testing serves the 7-day intro offers.
# Only touches the generated ios/ folder on the CI runner. This script does not start a run,
# EAS build, or App Store Connect write.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${OUT:-$PWD/artifacts}"
mkdir -p "$OUT"
cd "$ROOT"
APP_DIR="$ROOT/app" "$ROOT/scripts/ios-sim-qa/attach-storekit-scheme.sh" | tee -a "$OUT/prepare.log"
APP_DIR="$ROOT/app" "$ROOT/scripts/ios-sim-qa/add-storekit-uitest.sh" | tee -a "$OUT/prepare.log"
APP_DIR="$ROOT/app" "$ROOT/scripts/ios-sim-qa/attach-storekit-scheme.sh" | tee -a "$OUT/prepare.log"
{
  echo "==> StoreKit scheme references"
  grep -n "StoreKitConfigurationFileReference" -A1 app/ios/*.xcodeproj/xcshareddata/xcschemes/*.xcscheme 2>/dev/null || \
    grep -nR "StoreKitConfigurationFileReference" app/ios --include='*.xcscheme' || \
    echo "No StoreKitConfigurationFileReference found (attach-storekit-scheme.sh should have failed)"
  echo "==> Intro offers in ios/Playsz.storekit"
  python3 - "$ROOT/app/ios/Playsz.storekit" << 'PY'
import json, sys
sk = json.load(open(sys.argv[1]))
subs = sk["subscriptionGroups"][0]["subscriptions"]
for s in subs:
    offer = s.get("introductoryOffer")
    print(f"{s['productID']}: {offer}")
life = next(p for p in sk["products"] if p["productID"] == "playsz_pro_lifetime")
print(f"{life['productID']}: introductoryOffer={life.get('introductoryOffer')}")
PY
} | tee -a "$OUT/prepare.log"
