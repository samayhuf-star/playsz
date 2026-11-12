#!/usr/bin/env bash
# After `expo prebuild`, copy Playsz.storekit into ios/ and point every shared
# Xcode scheme's LaunchAction and TestAction at it.
# StoreKit Testing is injected by Xcode / `xcodebuild test`, not by a bare
# `simctl launch`. The scheme reference is still required for any Xcode-launched
# run; Maestro + simctl may not see products (the QA runner records SKIP then).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="${APP_DIR:-$ROOT/app}"
SRC="$APP_DIR/ios-storekit/Playsz.storekit"
IOS_DIR="$APP_DIR/ios"

if [[ ! -f "$SRC" ]]; then
  echo "Missing StoreKit file: $SRC" >&2
  exit 1
fi
if [[ ! -d "$IOS_DIR" ]]; then
  echo "Missing ios/ directory; run expo prebuild first." >&2
  exit 1
fi

cp "$SRC" "$IOS_DIR/Playsz.storekit"
echo "Copied StoreKit config to $IOS_DIR/Playsz.storekit"

python3 - "$IOS_DIR" << 'PY'
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

ios = Path(sys.argv[1])
schemes = list(ios.glob("*.xcodeproj/xcshareddata/xcschemes/*.xcscheme"))
if not schemes:
    # Some Expo prebuilds also write user schemes only; search more broadly.
    schemes = list(ios.glob("**/*.xcscheme"))
if not schemes:
    raise SystemExit("No .xcscheme files found under ios/")

# identifier is relative to the .xcodeproj directory
# ios/Playsz.storekit from ios/<Name>.xcodeproj is ../Playsz.storekit

def already_has(parent):
    for child in list(parent):
        if child.tag == "StoreKitConfigurationFileReference":
            return child
    return None

patched = 0
for scheme in schemes:
    # Preserve the Xcode scheme attribute style as much as possible by
    # doing a text-level insertion if the element is missing.
    text = scheme.read_text()
    if "StoreKitConfigurationFileReference" in text:
        print(f"Already referenced in {scheme}")
        continue
    block = (
        "      <StoreKitConfigurationFileReference\n"
        '         identifier = "../Playsz.storekit">\n'
        "      </StoreKitConfigurationFileReference>\n"
    )
    changed = text
    for tag in ("LaunchAction", "TestAction", "ProfileAction"):
        close = f"   </{tag}>"
        # Only insert into tags that exist and do not already contain the ref
        if close in changed:
            # insert before the last occurrence of this closing tag that is
            # at the action level (3-space indent as produced by Xcode)
            idx = changed.rfind(close)
            if idx == -1:
                continue
            changed = changed[:idx] + block + changed[idx:]
    if changed == text:
        raise SystemExit(f"Could not patch scheme: {scheme}")
    scheme.write_text(changed)
    patched += 1
    print(f"Patched StoreKitConfigurationFileReference into {scheme}")

print(f"Patched {patched} scheme(s)")
PY
