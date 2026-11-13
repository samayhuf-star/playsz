#!/usr/bin/env python3
"""Drive Maestro flows, time the cold launch, and write PASS/FAIL/SKIP results."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

BUNDLE_ID = os.environ.get("BUNDLE_ID", "com.samayvashsht.playsz")
ROOT = Path(os.environ.get("GITHUB_WORKSPACE") or Path(__file__).resolve().parents[2])
FLOWS = ROOT / ".maestro"
ARTIFACTS = Path(os.environ.get("QA_ARTIFACTS", "/tmp/playsz-qa-artifacts"))
MEDIA_DIR = Path(os.environ.get("QA_MEDIA_DIR", "/tmp/playsz-qa-media"))
LAUNCH_LIMIT_MS = 2000

ARTIFACTS.mkdir(parents=True, exist_ok=True)
MAESTRO_DIR = ARTIFACTS / "maestro"
MAESTRO_DIR.mkdir(parents=True, exist_ok=True)

steps: list[dict] = []


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def record(step_id: str, name: str, status: str, detail: str = "", extra: dict | None = None) -> dict:
    item = {"id": step_id, "name": name, "status": status, "detail": detail}
    if extra:
        item.update(extra)
    steps.append(item)
    print(f"==> [{status}] {name}: {detail}", flush=True)
    return item


SHOT_DIR = ARTIFACTS / "screenshots"
SHOT_DIR.mkdir(parents=True, exist_ok=True)


def screenshot(name: str) -> Path | None:
    dest = SHOT_DIR / f"{name}.png"
    udid = os.environ.get("UDID") or os.environ.get("SIM_UDID") or "booted"
    result = subprocess.run(
        ["xcrun", "simctl", "io", udid, "screenshot", str(dest)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        result = subprocess.run(
            ["xcrun", "simctl", "io", "booted", "screenshot", str(dest)],
            capture_output=True,
            text=True,
        )
    if result.returncode == 0 and dest.exists():
        print(f"screenshot: {dest}", flush=True)
        return dest
    print(f"screenshot failed for {name}: {(result.stderr or result.stdout or '').strip()}", flush=True)
    return None


def maestro(*args: str, env: dict | None = None, timeout: int = 180) -> subprocess.CompletedProcess:
    cmd = ["maestro", "test", *args]
    print("+", " ".join(cmd), flush=True)
    run_env = os.environ.copy()
    if env:
        run_env.update(env)
    return subprocess.run(cmd, env=run_env, text=True, capture_output=True, timeout=timeout)


def run_flow(flow: str, tag: str, extra: list[str] | None = None, timeout: int = 180) -> subprocess.CompletedProcess:
    debug = MAESTRO_DIR / tag
    debug.mkdir(parents=True, exist_ok=True)
    junit = MAESTRO_DIR / f"{tag}.xml"
    log_path = MAESTRO_DIR / f"{tag}.log"
    args = [
        "--debug-output",
        str(debug),
        "--format",
        "JUNIT",
        "--output",
        str(junit),
        *(extra or []),
        str(FLOWS / flow),
    ]
    result = maestro(*args, timeout=timeout)
    log_path.write_text(
        f"$ maestro test {' '.join(args)}\n\nexit={result.returncode}\n\n"
        f"--- stdout ---\n{result.stdout}\n\n--- stderr ---\n{result.stderr}\n"
    )
    if result.stdout:
        print(result.stdout[-4000:], flush=True)
    if result.returncode != 0 and result.stderr:
        print(result.stderr[-4000:], file=sys.stderr, flush=True)
    return result


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def seed_manifest() -> dict:
    return load_json(ARTIFACTS / "seed-manifest.json")


# ---------------------------------------------------------------------------
# 1. Cold launch
# ---------------------------------------------------------------------------
# Terminate any previous process so launchApp stopApp:true is a true cold start.
subprocess.run(["xcrun", "simctl", "terminate", "booted", BUNDLE_ID], capture_output=True)

t0 = time.perf_counter()
launch = run_flow("01_library_ready.yaml", "01_library_ready")
launch_ms = int((time.perf_counter() - t0) * 1000)

if launch.returncode == 0:
    if launch_ms <= LAUNCH_LIMIT_MS:
        record(
            "cold_launch",
            "Cold launch to the library in under 2 s",
            "PASS",
            f"{launch_ms} ms (limit {LAUNCH_LIMIT_MS} ms). Simulator timing is approximate.",
            {"launchMs": launch_ms},
        )
    else:
        record(
            "cold_launch",
            "Cold launch to the library in under 2 s",
            "FAIL",
            f"{launch_ms} ms exceeds the {LAUNCH_LIMIT_MS} ms budget. "
            "Recorded honestly; simulator launch time is approximate and this "
            "step does not fail the overall job on its own.",
            {"launchMs": launch_ms, "softFail": True},
        )
else:
    record(
        "cold_launch",
        "Cold launch to the library in under 2 s",
        "FAIL",
        f"Library UI did not become ready ({launch_ms} ms). See maestro/01_library_ready.log.",
        {"launchMs": launch_ms},
    )

screenshot("01-launch")

# After first launch the data container exists; copy the SRT in for the picker.
copy_srt = ROOT / "scripts/ios-sim-qa/copy-srt-to-app.sh"
if copy_srt.exists():
    copied = subprocess.run(["bash", str(copy_srt)], text=True, capture_output=True)
    print(copied.stdout or copied.stderr, flush=True)

# ---------------------------------------------------------------------------
# 2. Play each seeded video
# ---------------------------------------------------------------------------
seed = seed_manifest()
photos = seed.get("photos", {})

play_plan = [
    ("play_mp4", "Open and play short MP4", "short_mp4", "library-video-playsz-qa-short"),
    ("play_mkv", "Open and play MKV", "mkv", "library-video-playsz-qa-mkv"),
    ("play_subs_source", "Open and play subtitled MP4", "subs_mp4", "library-video-playsz-qa-subs"),
    ("play_large", "Open and play large file", "large_mp4", "library-video-playsz-qa-large"),
]

# seed-media.sh adds clips to Photos in this order; the library lists them
# newest first (Date desc), so the last seeded clip is row 0. Used when Photos
# renamed the clip to IMG_NNNN and the original-filename testID is missing.
SEED_ORDER = ("short_mp4", "subs_mp4", "large_mp4", "mkv")
seeded_ok = [k for k in SEED_ORDER if (photos.get(k) or {}).get("ok")]


def video_env(key: str, video_id: str) -> list[str]:
    index = len(seeded_ok) - 1 - seeded_ok.index(key) if key in seeded_ok else 0
    return [
        "-e", f"VIDEO_ID={video_id}",
        "-e", f"VIDEO_INDEX={index}",
        "-e", f"OUT_SHOTS={SHOT_DIR}",
    ]


for step_id, name, key, video_id in play_plan:
    entry = photos.get(key) or {}
    if not entry.get("ok"):
        reason = entry.get("stderr") or "simctl addmedia did not succeed"
        if key == "mkv":
            reason = (
                "iOS Photos / simctl addmedia typically rejects Matroska (.mkv). "
                f"The file was generated but not seeded. {reason}"
            )
        record(step_id, name, "SKIP", reason)
        continue
    result = run_flow(
        "02_play_video.yaml",
        f"02_{step_id}",
        extra=video_env(key, video_id),
    )
    if result.returncode == 0:
        record(step_id, name, "PASS", f"Player screen, controls, and times visible for {video_id}.")
        if step_id == "play_mp4":
            screenshot("02-playing")
    else:
        record(
            step_id,
            name,
            "FAIL",
            f"Maestro could not open or play {video_id}. See maestro/02_{step_id}.log.",
        )

def clear_resume_positions() -> None:
    """Drop saved resume positions so the seek clip starts at 0:00, not near its end."""
    subprocess.run(["xcrun", "simctl", "terminate", "booted", BUNDLE_ID], capture_output=True)
    got = subprocess.run(
        ["xcrun", "simctl", "get_app_container", "booted", BUNDLE_ID, "data"],
        capture_output=True, text=True,
    )
    container = Path(got.stdout.strip()) if got.returncode == 0 else None
    if not container or not container.exists():
        print("clear_resume_positions: no data container", flush=True)
        return
    removed = 0
    for manifest in container.glob("**/RCTAsyncLocalStorage*/manifest.json"):
        try:
            data = json.loads(manifest.read_text() or "{}")
        except ValueError:
            continue
        keys = [k for k in data if k.startswith("playsz:resume:")]
        for k in keys:
            data.pop(k, None)
        removed += len(keys)
        manifest.write_text(json.dumps(data))
    print(f"clear_resume_positions: removed {removed} saved position(s)", flush=True)


# ---------------------------------------------------------------------------
# 3. Seek
# ---------------------------------------------------------------------------
if photos.get("short_mp4", {}).get("ok"):
    seek_env = video_env("short_mp4", "library-video-playsz-qa-short")
    clear_resume_positions()
    seek = run_flow("03_seek.yaml", "03_seek", extra=seek_env)
    if seek.returncode == 0:
        record("seek", "Seek (double-tap +10 s or seek bar)", "PASS", "Double-tap produced the player seek hint.")
    else:
        clear_resume_positions()
        swipe = run_flow("03_seek_swipe.yaml", "03_seek_swipe", extra=seek_env)
        if swipe.returncode == 0:
            record("seek", "Seek (double-tap +10 s or seek bar)", "PASS", "Horizontal swipe produced the player seek hint.")
        else:
            record(
                "seek",
                "Seek (double-tap +10 s or seek bar)",
                "FAIL",
                "Neither double-tap nor swipe showed the seek hint. See maestro/03_seek*.log.",
            )
else:
    record("seek", "Seek (double-tap +10 s or seek bar)", "SKIP", "Short MP4 was not seeded, so seek was not attempted.")

# ---------------------------------------------------------------------------
# 3b. Store stills (not gating): player mid-play, speed panel, subtitles panel.
# Screenshots come from simctl, so Maestro takeScreenshot paths do not matter.
# ---------------------------------------------------------------------------
if photos.get("short_mp4", {}).get("ok"):
    try:
        still = run_flow("06_player_shot.yaml", "06_player_shot",
                         extra=video_env("short_mp4", "library-video-playsz-qa-short"))
        if still.returncode == 0:
            screenshot("02-player-playing")
            for chip, name in (("player-speed", "06-feature-speed"), ("player-subs", "07-feature-subs")):
                panel = run_flow("07_feature_panel.yaml", f"07_{chip}", extra=["-e", f"CHIP={chip}"])
                if panel.returncode == 0:
                    screenshot(name)
                    # Close the panel again so the next chip starts clean.
                    run_flow("07_feature_panel.yaml", f"07_{chip}_close", extra=["-e", f"CHIP={chip}"])
        run_flow("06_player_back.yaml", "06_player_back")
    except subprocess.TimeoutExpired:
        print("store stills timed out", flush=True)

# ---------------------------------------------------------------------------
# 4. Subtitles
# ---------------------------------------------------------------------------
if photos.get("subs_mp4", {}).get("ok"):
    try:
        subs = run_flow(
            "04_subtitles.yaml",
            "04_subtitles",
            extra=video_env("subs_mp4", "library-video-playsz-qa-subs"),
            timeout=240,
        )
    except subprocess.TimeoutExpired:
        subs = subprocess.CompletedProcess(args=["maestro"], returncode=124)
    if subs.returncode == 0:
        record(
            "subtitles",
            "Show SRT subtitles",
            "PASS",
            "Imported the SRT (or selected it) and 'PLAYSZ QA SUBTITLE LINE' was visible.",
        )
    else:
        record(
            "subtitles",
            "Show SRT subtitles",
            "FAIL",
            "Could not import the .srt through the iOS document picker, or the cue "
            "text did not appear. The picker is flaky on a headless simulator; "
            "the SRT was copied to the app Documents/qa-fixtures folder. "
            "See maestro/04_subtitles.log. Recorded as a soft failure: the "
            "headless document picker is a harness limit, so this needs a manual check.",
            {"softFail": True},
        )
else:
    record("subtitles", "Show SRT subtitles", "SKIP", "The subtitled MP4 was not seeded.")


def run_storekit_uitest() -> subprocess.CompletedProcess:
    """Purchase and Restore via xcodebuild test so the .storekit file is injected."""
    workspace = os.environ.get("WORKSPACE", "")
    scheme = "PlayszStoreKitUITests"
    if workspace:
        candidate = Path(workspace).parent / "PlayszAllInOnePlayer.xcodeproj/xcshareddata/xcschemes/PlayszStoreKitUITests.xcscheme"
        if not candidate.exists():
            # Workspace lives next to the xcodeproj.
            for alt in Path(workspace).parent.glob("*.xcodeproj/xcshareddata/xcschemes/PlayszStoreKitUITests.xcscheme"):
                candidate = alt
                break
        if not candidate.exists():
            scheme = os.environ.get("SCHEME", "")
    else:
        scheme = os.environ.get("SCHEME", "")
    udid = os.environ.get("UDID") or os.environ.get("SIM_UDID") or ""
    derived = os.environ.get("DERIVED_DATA", "")
    log_path = ARTIFACTS / "storekit-uitest.log"
    if not (workspace and scheme and udid and derived and Path(workspace).exists()):
        missing = subprocess.CompletedProcess(
            args=["xcodebuild"], returncode=1, stdout="", stderr="WORKSPACE/SCHEME/UDID/DERIVED_DATA not set or workspace missing"
        )
        log_path.write_text("skipped: missing xcodebuild context\n")
        return missing
    # The workflow builds only the app scheme in Release (JS bundled). Build and
    # run the separate UI test scheme in the same Release config and with the
    # same signing overrides so the app target stays an incremental no-op.
    # A Debug build would need Metro and was what timed out before.
    cmd = [
        "xcodebuild", "test",
        "-workspace", workspace,
        "-scheme", scheme,
        "-configuration", "Release",
        "-sdk", "iphonesimulator",
        "-destination", f"platform=iOS Simulator,id={udid}",
        "-derivedDataPath", derived,
        "-only-testing:PlayszStoreKitUITests",
        "CODE_SIGN_IDENTITY=-",
        "CODE_SIGN_STYLE=Manual",
        "DEVELOPMENT_TEAM=",
        "PROVISIONING_PROFILE_SPECIFIER=",
    ]
    env = os.environ.copy()
    env["QA_ARTIFACTS"] = str(ARTIFACTS)
    env["OUT"] = str(ARTIFACTS)
    # xcodebuild forwards only TEST_RUNNER_* variables into the UI test runner.
    env["TEST_RUNNER_QA_ARTIFACTS"] = str(ARTIFACTS)
    env["TEST_RUNNER_OUT"] = str(ARTIFACTS)
    print("+", " ".join(cmd), flush=True)
    try:
        result = subprocess.run(cmd, env=env, text=True, capture_output=True, timeout=1500)
    except subprocess.TimeoutExpired as exc:
        out = exc.stdout.decode() if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        log_path.write_text(out + "\nTIMEOUT after 1500 s\n")
        print(f"storekit uitest timed out; log={log_path}", flush=True)
        return subprocess.CompletedProcess(args=cmd, returncode=124, stdout=out, stderr="timeout")
    log_path.write_text((result.stdout or "") + "\n" + (result.stderr or ""))
    print(f"storekit uitest exit={result.returncode}; log={log_path}", flush=True)
    return result


# ---------------------------------------------------------------------------
# 5. Paywall / StoreKit
# ---------------------------------------------------------------------------
STOREKIT_SKIP_REASON = (
    "A StoreKit Configuration file is attached to the Xcode scheme "
    "(StoreKitConfigurationFileReference → ios/Playsz.storekit) so that "
    "Xcode and `xcodebuild test` can inject test products. "
    "This QA run launches the Release .app with simctl and drives it with "
    "Maestro. Apple does not officially apply a .storekit file to a bare "
    "simctl launch, so StoreKit Testing often does not take effect here. "
    "Prices coming back as unavailable is treated as SKIP, not a fake PASS. "
    "A real App Store sandbox purchase on a device is still required before App Review."
)

opened = run_flow("05_paywall_open.yaml", "05_paywall_open")
if opened.returncode != 0:
    record(
        "paywall_prices",
        "Paywall shows StoreKit prices",
        "FAIL",
        "The paywall screen did not open. See maestro/05_paywall_open.log.",
    )
    record("paywall_trial", "Paywall shows 7-day trial copy", "SKIP", "Paywall did not open.")
    record("paywall_restore", "Restore purchases", "SKIP", "Paywall did not open.")
    record("paywall_purchase", "Test purchase", "SKIP", "Paywall did not open.")
else:
    screenshot("03-paywall")
    run_flow("05_paywall_screenshot.yaml", "05_paywall_screenshot")
    prices = run_flow("05_paywall_prices.yaml", "05_paywall_prices")
    if prices.returncode == 0:
        record(
            "paywall_prices",
            "Paywall shows StoreKit prices",
            "PASS",
            "Displayed $2.99 / $19.99 / $39.99 from the StoreKit configuration.",
        )
        trial = run_flow("05_paywall_trial.yaml", "05_paywall_trial")
        if trial.returncode == 0:
            record(
                "paywall_trial",
                "Paywall shows 7-day trial copy",
                "PASS",
                "Monthly and yearly show '7 days free, then <price>/month' (or /year). Lifetime stays a one-time purchase.",
            )
        else:
            record(
                "paywall_trial",
                "Paywall shows 7-day trial copy",
                "FAIL",
                "Prices were visible but the 7-day trial sentence was not. See maestro/05_paywall_trial.log.",
            )
        # Maestro + simctl cannot inject the .storekit file; a real App Store
        # sign-in sheet appears instead. Purchase and Restore run under
        # xcodebuild test so StoreKit Testing is applied.
        storekit = run_storekit_uitest()
        restore_shot = SHOT_DIR / "05-restore.png"
        purchase_shot = SHOT_DIR / "04-purchase.png"
        if storekit.returncode == 0:
            record(
                "paywall_restore",
                "Restore purchases",
                "PASS",
                "Restore completed under xcodebuild test with Playsz.storekit.",
            )
            record(
                "paywall_purchase",
                "Test purchase",
                "PASS",
                "Yearly plan purchase completed under xcodebuild test; Pro unlocked in the UI.",
            )
            if not restore_shot.exists():
                screenshot("05-restore")
            if not purchase_shot.exists():
                screenshot("04-purchase")
        else:
            record(
                "paywall_restore",
                "Restore purchases",
                "FAIL",
                "StoreKit UI test did not complete Restore. See storekit-uitest.log. If the screen shows 'Sign in to Apple Account', xcodebuild did not apply Playsz.storekit (known Xcode CLI limit on iOS 26 simulators), so the real sandbox was used.",
            )
            record(
                "paywall_purchase",
                "Test purchase",
                "FAIL",
                "StoreKit UI test did not complete the yearly purchase. See storekit-uitest.log. If the screen shows 'Sign in to Apple Account', xcodebuild did not apply Playsz.storekit (known Xcode CLI limit on iOS 26 simulators), so the real sandbox was used.",
            )
    else:
        unavailable = run_flow("05_paywall_unavailable.yaml", "05_paywall_unavailable")
        if unavailable.returncode == 0:
            record("paywall_prices", "Paywall shows StoreKit prices", "SKIP", STOREKIT_SKIP_REASON)
            record(
                "paywall_trial",
                "Paywall shows 7-day trial copy",
                "SKIP",
                "Skipped because StoreKit test products were not loaded in this simctl/Maestro session.",
            )
            record(
                "paywall_restore",
                "Restore purchases",
                "SKIP",
                "Skipped because StoreKit test products were not loaded in this simctl/Maestro session.",
            )
            record(
                "paywall_purchase",
                "Test purchase",
                "SKIP",
                "Skipped because StoreKit test products were not loaded in this simctl/Maestro session.",
            )
        else:
            record(
                "paywall_prices",
                "Paywall shows StoreKit prices",
                "FAIL",
                "Paywall opened, but neither the expected $2.99/$19.99/$39.99 prices "
                "nor the 'Prices unavailable' state could be confirmed. "
                "See maestro/05_paywall_*.log.",
            )
            record("paywall_trial", "Paywall shows 7-day trial copy", "SKIP", "Could not confirm prices, so trial copy was not asserted.")
            record("paywall_restore", "Restore purchases", "SKIP", "Could not confirm prices, so Restore was not asserted.")
            record("paywall_purchase", "Test purchase", "SKIP", "Could not confirm prices, so no purchase was attempted.")
    run_flow("05_paywall_close.yaml", "05_paywall_close")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
functional_ids = {
    "play_mp4",
    "play_mkv",
    "play_subs_source",
    "play_large",
    "seek",
    "subtitles",
    "paywall_prices",
    "paywall_trial",
    "paywall_restore",
    "paywall_purchase",
}
hard_fails = [
    s for s in steps
    if s["status"] == "FAIL" and not s.get("softFail")
]
soft_fails = [s for s in steps if s.get("softFail")]
passes = [s for s in steps if s["status"] == "PASS"]
skips = [s for s in steps if s["status"] == "SKIP"]

if hard_fails:
    overall = "FAIL"
elif soft_fails:
    overall = "PASS_WITH_WARNINGS"
else:
    overall = "PASS"

results = {
    "app": "Playsz",
    "bundleId": BUNDLE_ID,
    "commit": os.environ.get("QA_COMMIT") or os.environ.get("GITHUB_SHA") or "",
    "ref": os.environ.get("GITHUB_REF") or "",
    "simulator": os.environ.get("QA_SIMULATOR") or "",
    "startedAt": os.environ.get("QA_STARTED_AT") or "",
    "finishedAt": now_iso(),
    "launchMs": launch_ms,
    "launchLimitMs": LAUNCH_LIMIT_MS,
    "overall": overall,
    "counts": {
        "pass": len(passes),
        "fail": len([s for s in steps if s["status"] == "FAIL"]),
        "skip": len(skips),
    },
    "steps": steps,
    "notes": [
        "cold_launch is a soft failure when the library appears but takes more than 2 s; "
        "simulator timing is approximate and that alone does not fail the job.",
        "StoreKit Configuration is wired into the generated Xcode scheme, but it may not "
        "take effect for a simctl + Maestro launch. That case is recorded as SKIP.",
        "Monthly and yearly trial copy is asserted only when StoreKit prices load.",
    ],
}

results_path = ARTIFACTS / "results.json"
results_path.write_text(json.dumps(results, indent=2) + "\n")
print(f"Wrote {results_path}", flush=True)

# GitHub Step Summary (and a local markdown copy)
def md_row(s: dict) -> str:
    detail = (s.get("detail") or "").replace("\n", " ").replace("|", "\\|")
    if len(detail) > 280:
        detail = detail[:277] + " [truncated]"
    return f"| `{s['id']}` | {s['name']} | **{s['status']}** | {detail} |"

lines = [
    "# Playsz iOS simulator QA",
    "",
    f"- **Overall:** {overall}",
    f"- **Commit:** `{results['commit']}`",
    f"- **Simulator:** {results['simulator'] or '(see logs)'}",
    f"- **Cold launch:** {launch_ms} ms (limit {LAUNCH_LIMIT_MS} ms)",
    f"- **Counts:** {results['counts']['pass']} pass / {results['counts']['fail']} fail / {results['counts']['skip']} skip",
    "",
    "| Step | Name | Result | Detail |",
    "| --- | --- | --- | --- |",
]
lines.extend(md_row(s) for s in steps)
lines += [
    "",
    "## Notes",
    "",
    "- Standard `macos-latest` runner only. No large/xlarge runners.",
    "- StoreKit products are defined in `app/ios-storekit/Playsz.storekit` and attached to the scheme after prebuild.",
    "- A StoreKit Configuration purchase is local and simulated; it is not an App Store sandbox purchase.",
    "- Monthly and yearly include a 7-day free intro offer in Playsz.storekit; lifetime does not.",
    f"- Screenshots: `{SHOT_DIR}`",
]
summary = "\n".join(lines) + "\n"
(ARTIFACTS / "summary.md").write_text(summary)
step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
if step_summary:
    with open(step_summary, "a", encoding="utf-8") as fh:
        fh.write(summary)
print(summary)

# Exit 1 only for hard functional failures
sys.exit(1 if hard_fails else 0)
