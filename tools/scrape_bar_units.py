#!/usr/bin/env python3
"""
Fetch Armada energy-building unit definitions from the BAR GitHub repo (Lua source)
and write a JSON cache to tools/cache/bar_units_raw.json.

Run from project root:
    python tools/scrape_bar_units.py

The cache is gitignored; run this whenever you want fresh upstream data.
"""

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

REPO_RAW = "https://raw.githubusercontent.com/beyond-all-reason/Beyond-All-Reason/master"

# Canonical unit key → (github_subpath, lua_unit_name)
UNITS = {
    "Wind":     ("units/ArmBuildings/LandEconomy/armwin.lua",    "armwin"),
    "Tidal":    ("units/ArmBuildings/SeaEconomy/armtide.lua",    "armtide"),
    "Solar":    ("units/ArmBuildings/LandEconomy/armsolar.lua",  "armsolar"),
    "AdvSolar": ("units/ArmBuildings/LandEconomy/armadvsol.lua", "armadvsol"),
    "Geo":      ("units/ArmBuildings/LandEconomy/armgeo.lua",    "armgeo"),
    "Fusion":   ("units/ArmBuildings/LandEconomy/armfus.lua",    "armfus"),
    "AdvGeo":   ("units/ArmBuildings/LandEconomy/armageo.lua",   "armageo"),
    "UWFusion": ("units/ArmBuildings/SeaEconomy/armuwfus.lua",   "armuwfus"),
    "AFUS":     ("units/ArmBuildings/LandEconomy/armafus.lua",   "armafus"),
}

# Fields to extract from the top-level unit table (not nested tables like customparams)
SCALAR_FIELDS = {
    "metalcost", "energycost", "buildtime",
    "energyupkeep",     # negative = production (armsolar: energyupkeep = -20)
    "energymake",       # explicit production (armafus: energymake = 3000)
    "windgenerator",    # max wind output (armwin)
    "tidalgenerator",   # max tidal output (armtide)
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "bar-eco-manifold-scraper/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode("utf-8")


def parse_lua_unit(lua_src: str, unit_name: str) -> dict:
    """
    Extract scalar fields from the top-level unit table in a BAR Lua unit def.

    The files look like:
        return {
            armwin = {
                buildtime = 1600,
                metalcost = 40,
                customparams = {
                    ...nested...
                },
            },
        }

    Strategy: find the opening brace of the named unit table, then scan lines
    until we hit a nested brace block — skip those — and parse `key = value`
    pairs only from the top level.
    """
    # Locate the start of the unit's table body
    header_pattern = re.compile(
        rf'\b{re.escape(unit_name)}\s*=\s*\{{', re.IGNORECASE
    )
    m = header_pattern.search(lua_src)
    if not m:
        raise ValueError(f"Unit '{unit_name}' table not found in Lua source")

    body_start = m.end()
    depth = 1
    pos = body_start
    top_level_lines: list[str] = []
    chars = lua_src[body_start:]

    i = 0
    line_buf: list[str] = []
    while i < len(chars) and depth > 0:
        ch = chars[i]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                break
        if depth == 1:
            # only collect characters at the immediate top level of the unit table
            if ch == '\n':
                top_level_lines.append(''.join(line_buf))
                line_buf = []
            else:
                line_buf.append(ch)
        i += 1

    result: dict = {}
    kv_pattern = re.compile(r'^\s*(\w+)\s*=\s*(-?[\d.]+)\s*,?\s*(?:--.*)?$')
    for line in top_level_lines:
        m2 = kv_pattern.match(line)
        if m2:
            key = m2.group(1).lower()
            if key in SCALAR_FIELDS:
                result[key] = float(m2.group(2))

    return result


def derive_energy_output(raw: dict, key: str) -> float | None:
    """
    Normalise the various ways BAR expresses energy production into E/s.

    - energymake = N          → N E/s (armafus, armfus, armgeo, etc.)
    - energyupkeep = -N       → N E/s (armsolar, armadvsol)
    - windgenerator = N       → max N E/s but output is map-dependent; return None
    - tidalgenerator = 1      → boolean flag; output is map tidal strength; return None

    Variable units (wind, tidal) have no fixed output and are excluded from ROI
    calculations in the app, so we return None to signal "variable, no o: field".
    """
    if "energymake" in raw and raw["energymake"] > 0:
        return raw["energymake"]
    if "energyupkeep" in raw and raw["energyupkeep"] < 0:
        return -raw["energyupkeep"]
    # windgenerator / tidalgenerator → variable output; no fixed E/s to report
    return None


def main():
    cache_path = Path(__file__).parent / "cache" / "bar_units_raw.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    results: dict = {}
    errors: list[str] = []

    for key, (path, lua_name) in UNITS.items():
        url = f"{REPO_RAW}/{path}"
        print(f"  fetching {key:10s}  {url}")
        try:
            src = fetch(url)
            raw = parse_lua_unit(src, lua_name)
            output = derive_energy_output(raw, key)
            results[key] = {
                "lua_name":  lua_name,
                "lua_path":  path,
                "raw":       raw,
                "derived": {
                    "m":  int(raw.get("metalcost", 0)),
                    "e":  int(raw.get("energycost", 0)),
                    "l":  int(raw.get("buildtime", 0)),
                    "o":  int(output) if output is not None else None,
                    "variable": ("windgenerator" in raw or "tidalgenerator" in raw),
                },
            }
            derived = results[key]["derived"]
            print(f"             m={derived['m']:>6}  e={derived['e']:>6}  "
                  f"l={derived['l']:>7}  o={str(derived['o']):>5}  "
                  f"variable={derived['variable']}")
        except Exception as exc:
            print(f"  ERROR {key}: {exc}", file=sys.stderr)
            errors.append(f"{key}: {exc}")
        time.sleep(0.3)   # be polite to GitHub

    cache_path.write_text(json.dumps(results, indent=2))
    print(f"\nWrote {len(results)} units to {cache_path}")
    if errors:
        print(f"\n{len(errors)} error(s):", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
