#!/usr/bin/env bash
# Print "udid\tname\truntime" for the best available iPhone 16, then iPhone 15.
# Creates a device if a matching runtime exists but no device does.
set -euo pipefail

python3 - << 'PY'
import json, subprocess, sys

raw = subprocess.check_output(["xcrun", "simctl", "list", "-j"], text=True)
data = json.loads(raw)

runtimes = data.get("runtimes", [])
available_runtimes = [
    r for r in runtimes
    if r.get("isAvailable") and "iOS" in (r.get("name") or r.get("identifier") or "")
]
# Prefer the newest iOS runtime
available_runtimes.sort(key=lambda r: r.get("version", ""), reverse=True)

devices_by_runtime = data.get("devices", {})

def is_iphone_16(name: str) -> bool:
    return name.startswith("iPhone 16") and "Plus" not in name and "Pro" not in name and name == "iPhone 16"

def score(name: str):
    # Lower is better. Exact "iPhone 16" / "iPhone 15" beat Pro/Plus/Max variants.
    order = [
        "iPhone 16",
        "iPhone 16 Plus",
        "iPhone 16e",
        "iPhone 16 Pro",
        "iPhone 16 Pro Max",
        "iPhone 15",
        "iPhone 15 Plus",
        "iPhone 15 Pro",
        "iPhone 15 Pro Max",
    ]
    try:
        return order.index(name)
    except ValueError:
        if name.startswith("iPhone 16"):
            return 20
        if name.startswith("iPhone 15"):
            return 30
        return 100

candidates = []
for runtime_id, devices in devices_by_runtime.items():
    # Skip unavailable / unavailable runtimes
    rt = next((r for r in runtimes if r.get("identifier") == runtime_id or r.get("name") == runtime_id), None)
    if rt and not rt.get("isAvailable", True):
        continue
    for dev in devices:
        name = dev.get("name") or ""
        if score(name) >= 100:
            continue
        if not dev.get("isAvailable", True):
            continue
        candidates.append({
            "udid": dev["udid"],
            "name": name,
            "runtime": runtime_id,
            "state": dev.get("state"),
            "score": score(name),
        })

candidates.sort(key=lambda c: (c["score"], c["name"]))
if candidates:
    best = candidates[0]
    print(f"{best['udid']}\t{best['name']}\t{best['runtime']}")
    sys.exit(0)

# No existing device: create one from an available iPhone 16/15 type + newest runtime
devicetypes = data.get("devicetypes", [])
types = []
for dt in devicetypes:
    name = dt.get("name") or ""
    if score(name) < 100:
        types.append((score(name), name, dt.get("identifier")))
types.sort()
if not types or not available_runtimes:
    print("No iPhone 15/16 simulator type or iOS runtime is available.", file=sys.stderr)
    # Dump a short inventory to help debug a first run
    print("Device types:", ", ".join(dt.get("name","") for dt in devicetypes if "iPhone" in (dt.get("name") or "")), file=sys.stderr)
    print("Runtimes:", ", ".join(r.get("name","") for r in runtimes), file=sys.stderr)
    sys.exit(1)

_, type_name, type_id = types[0]
runtime = available_runtimes[0]
runtime_id = runtime["identifier"]
create_name = f"Playsz QA {type_name}"
print(f"Creating simulator {create_name} ({runtime.get('name')})", file=sys.stderr)
udid = subprocess.check_output(
    ["xcrun", "simctl", "create", create_name, type_id, runtime_id],
    text=True,
).strip()
print(f"{udid}\t{create_name}\t{runtime_id}")
PY
