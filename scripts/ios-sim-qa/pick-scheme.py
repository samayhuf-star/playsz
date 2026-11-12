#!/usr/bin/env python3
"""Print the best Xcode scheme name from `xcodebuild -list -json` output."""
import json, sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text())
schemes = data.get("workspace", data.get("project", {})).get("schemes", [])
if not schemes:
    raise SystemExit("No Xcode schemes found")
prefer = [s for s in schemes if "playsz" in s.lower() or "openplay" in s.lower()]
print((prefer or schemes)[0])
