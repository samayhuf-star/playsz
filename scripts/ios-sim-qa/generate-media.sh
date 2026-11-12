#!/usr/bin/env bash
# Generate the four QA fixtures: short MP4, MKV, MP4+SRT, and a ~300–500 MB MP4.
set -euo pipefail

OUT="${1:-${QA_MEDIA_DIR:-/tmp/playsz-qa-media}}"
mkdir -p "$OUT"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is not on PATH" >&2
  exit 1
fi

echo "Generating test media in $OUT"

# 10 s H.264 + AAC MP4 (color bars + tone, no copyrighted content)
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=10" \
  -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=10" \
  -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 23 \
  -c:a aac -b:a 128k -shortest \
  -movflags +faststart \
  "$OUT/playsz-qa-short.mp4"

# Same stream in Matroska
ffmpeg -y -hide_banner -loglevel error \
  -i "$OUT/playsz-qa-short.mp4" \
  -c copy \
  "$OUT/playsz-qa-mkv.mkv"

# A second 10 s MP4 used with an external SRT (same encoder, different pattern)
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "testsrc2=size=1280x720:rate=30:duration=10" \
  -f lavfi -i "sine=frequency=660:sample_rate=44100:duration=10" \
  -c:v libx264 -pix_fmt yuv420p -preset veryfast -crf 23 \
  -c:a aac -b:a 128k -shortest \
  -movflags +faststart \
  "$OUT/playsz-qa-subs.mp4"

# Unique, easy-to-assert cue covering the whole clip
cat > "$OUT/playsz-qa-subs.srt" << 'SRT'
1
00:00:00,000 --> 00:00:10,000
PLAYSZ QA SUBTITLE LINE
SRT

# ~300–500 MB file, built quickly by concatenating stream copies of a
# slightly larger (but still cheap) base clip.
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=black:s=1280x720:r=30:d=8" \
  -f lavfi -i "anullsrc=r=44100:cl=stereo:d=8" \
  -c:v libx264 -pix_fmt yuv420p -preset ultrafast -b:v 12M \
  -c:a aac -b:a 64k -shortest \
  "$OUT/_chunk.mp4"

CHUNK_SIZE=$(wc -c < "$OUT/_chunk.mp4")
# Target ~400 MB
COPIES=$(( (400 * 1024 * 1024) / CHUNK_SIZE + 1 ))
if (( COPIES < 2 )); then COPIES=2; fi
LIST="$OUT/_concat.txt"
: > "$LIST"
for _ in $(seq 1 "$COPIES"); do
  # concat demuxer needs the path; use the chunk name only (same dir)
  printf "file '%s'\n" "$OUT/_chunk.mp4" >> "$LIST"
done
ffmpeg -y -hide_banner -loglevel error \
  -f concat -safe 0 -i "$LIST" -c copy \
  "$OUT/playsz-qa-large.mp4"
rm -f "$OUT/_chunk.mp4" "$OUT/_concat.txt"

python3 - "$OUT" << 'PY'
import json, os, sys
from pathlib import Path
out = Path(sys.argv[1])
files = {
    "short_mp4": "playsz-qa-short.mp4",
    "mkv": "playsz-qa-mkv.mkv",
    "subs_mp4": "playsz-qa-subs.mp4",
    "subs_srt": "playsz-qa-subs.srt",
    "large_mp4": "playsz-qa-large.mp4",
}
manifest = {"dir": str(out), "files": {}}
for key, name in files.items():
    path = out / name
    if not path.exists():
        raise SystemExit(f"missing {path}")
    size = path.stat().st_size
    manifest["files"][key] = {"name": name, "path": str(path), "bytes": size}
    print(f"  {name}: {size / (1024*1024):.1f} MiB")
large = manifest["files"]["large_mp4"]["bytes"]
if large < 300 * 1024 * 1024 or large > 550 * 1024 * 1024:
    print(f"WARNING: large file is {large / (1024*1024):.1f} MiB (wanted 300–500)", file=sys.stderr)
(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Wrote {out / 'manifest.json'}")
PY
