#!/usr/bin/env bash
# After the app has launched at least once, copy the SRT into Documents/.
set -euo pipefail
BUNDLE_ID="${BUNDLE_ID:-com.samayvashsht.playsz}"
MEDIA_DIR="${QA_MEDIA_DIR:-/tmp/playsz-qa-media}"
SRT="$MEDIA_DIR/playsz-qa-subs.srt"
CONTAINER="$(xcrun simctl get_app_container booted "$BUNDLE_ID" data)"
DEST_DIR="$CONTAINER/Documents/qa-fixtures"
mkdir -p "$DEST_DIR"
cp "$SRT" "$DEST_DIR/playsz-qa-subs.srt"
echo "Copied SRT to $DEST_DIR/playsz-qa-subs.srt"
