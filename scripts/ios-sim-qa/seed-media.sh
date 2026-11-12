#!/usr/bin/env bash
# Seed the booted simulator: add videos to Photos, copy the SRT into the app
# container (and a Files-visible location when possible). Writes a seed manifest.
set -euo pipefail

BUNDLE_ID="${BUNDLE_ID:-com.samayvashsht.playsz}"
MEDIA_DIR="${QA_MEDIA_DIR:-/tmp/playsz-qa-media}"
ARTIFACTS="${QA_ARTIFACTS:-/tmp/playsz-qa-artifacts}"
mkdir -p "$ARTIFACTS"

if [[ ! -f "$MEDIA_DIR/manifest.json" ]]; then
  echo "Media manifest not found in $MEDIA_DIR. Run generate-media.sh first." >&2
  exit 1
fi

# Full Photos access so the library scan does not show a permission sheet.
xcrun simctl privacy booted grant photos "$BUNDLE_ID" || true
xcrun simctl privacy booted grant photos-add "$BUNDLE_ID" || true

python3 - "$MEDIA_DIR" "$ARTIFACTS" "$BUNDLE_ID" << 'PY'
import json, os, shutil, subprocess, sys
from pathlib import Path

media_dir = Path(sys.argv[1])
artifacts = Path(sys.argv[2])
bundle_id = sys.argv[3]
src = json.loads((media_dir / "manifest.json").read_text())

def run(cmd):
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(cmd, text=True, capture_output=True)

seeded = {"photos": {}, "srt": {}, "notes": []}

# Photos: MP4s should work. MKV is often rejected by iOS Photos / addmedia.
for key in ("short_mp4", "subs_mp4", "large_mp4", "mkv"):
    info = src["files"][key]
    path = info["path"]
    result = run(["xcrun", "simctl", "addmedia", "booted", path])
    ok = result.returncode == 0
    entry = {
        "name": info["name"],
        "path": path,
        "ok": ok,
        "stderr": (result.stderr or "").strip()[-500:],
        "stdout": (result.stdout or "").strip()[-500:],
        "qaId": "library-video-" + Path(info["name"]).stem,
        "titleHint": info["name"],
    }
    seeded["photos"][key] = entry
    status = "OK" if ok else "FAILED"
    print(f"addmedia {info['name']}: {status}")
    if not ok:
        print(result.stderr, file=sys.stderr)

# SRT: not a Photos asset. Copy into the app data container Documents/ so a
# later document-picker or a Files browse might see it. The app must have been
# installed (container exists). get_app_container fails if the app has never
# been launched; try anyway, and also place a copy under the simulator media dir.
srt = src["files"]["subs_srt"]
srt_copied = False
container = run(["xcrun", "simctl", "get_app_container", "booted", bundle_id, "data"])
if container.returncode == 0:
    data_root = Path(container.stdout.strip())
    dest_dir = data_root / "Documents" / "qa-fixtures"
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / "playsz-qa-subs.srt"
    shutil.copy2(srt["path"], dest)
    srt_copied = True
    seeded["srt"]["appDocuments"] = str(dest)
    print(f"Copied SRT to app Documents: {dest}")
else:
    seeded["notes"].append(
        "get_app_container failed before first launch; will retry after launch."
    )
    seeded["srt"]["appDocuments"] = None
    print("App data container not available yet (app may need a first launch).")

# Also keep a well-known copy next to artifacts for debugging
art_srt = artifacts / "playsz-qa-subs.srt"
shutil.copy2(srt["path"], art_srt)
seeded["srt"]["artifacts"] = str(art_srt)

out = artifacts / "seed-manifest.json"
out.write_text(json.dumps(seeded, indent=2) + "\n")
print(f"Wrote {out}")
PY

# Give Photos a few seconds to index newly added videos.
echo "Waiting 5s for Photos to index new videos..."
sleep 5
