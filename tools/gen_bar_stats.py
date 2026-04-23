#!/usr/bin/env python3
"""
Read the scraped unit cache and generate the BAR_STATS JS block for App.jsx.

Run from project root:
    python tools/gen_bar_stats.py

Prints a diff against the current BAR_STATS in src/App.jsx, then (with --write)
patches the file in-place.

Usage:
    python tools/gen_bar_stats.py           # print diff only
    python tools/gen_bar_stats.py --write   # patch App.jsx
"""

import json
import re
import sys
import textwrap
from pathlib import Path

CACHE = Path(__file__).parent / "cache" / "bar_units_raw.json"
APP_JSX = Path(__file__).parent.parent / "src" / "App.jsx"

# Visual config that lives in the JS, not in the game data
VISUAL = {
    "Wind":     {"color": "0x4CAF50", "hex": "'#4CAF50'", "tags": "['t1', 'land', 'variable']"},
    "Tidal":    {"color": "0x00BCD4", "hex": "'#00BCD4'", "tags": "['t1', 'naval', 'variable']"},
    "Solar":    {"color": "0xFDD835", "hex": "'#FDD835'", "tags": "['t1', 'land']"},
    "AdvSolar": {"color": "0xFF9800", "hex": "'#FF9800'", "tags": "['t1', 'land']"},
    "Geo":      {"color": "0xE91E63", "hex": "'#E91E63'", "tags": "['t1', 'land', 'georeq']"},
    "Fusion":   {"color": "0x2196F3", "hex": "'#2196F3'", "tags": "['t2', 'land']"},
    "AdvGeo":   {"color": "0xF44336", "hex": "'#F44336'", "tags": "['t2', 'land', 'georeq']"},
    "UWFusion": {"color": "0x3F51B5", "hex": "'#3F51B5'", "tags": "['t2', 'naval']"},
    "AFUS":     {"color": "0x9C27B0", "hex": "'#9C27B0'", "tags": "['t2', 'land']"},
}

DISPLAY_NAMES = {
    "Wind":     "Wind Turbine",
    "Tidal":    "Tidal Generator",
    "Solar":    "Solar Collector",
    "AdvSolar": "Adv. Solar",
    "Geo":      "Geothermal",
    "Fusion":   "Fusion Reactor",
    "AdvGeo":   "Adv. Geothermal",
    "UWFusion": "Naval Fusion",
    "AFUS":     "Adv. Fusion",
}

ORDER = ["Wind", "Tidal", "Solar", "AdvSolar", "Geo", "Fusion", "AdvGeo", "UWFusion", "AFUS"]


def load_cache() -> dict:
    if not CACHE.exists():
        sys.exit(f"Cache not found: {CACHE}\nRun: python tools/scrape_bar_units.py")
    return json.loads(CACHE.read_text())


def build_bar_stats_block(cache: dict) -> str:
    lines = ["const BAR_STATS = {"]
    for key in ORDER:
        if key not in cache:
            print(f"WARNING: {key} missing from cache", file=sys.stderr)
            continue
        d = cache[key]["derived"]
        v = VISUAL[key]
        name = DISPLAY_NAMES[key]
        # variable units (wind, tidal) have no fixed E/s — omit o: entirely
        o_part = f"o: {d['o']},   " if (d["o"] is not None and not d["variable"]) else ""
        lines.append(
            f"  {key:<9}: {{ name: {name!r:<22}, "
            f"m: {d['m']:<5}, e: {d['e']:<6}, l: {d['l']:<7}, "
            f"{o_part}"
            f"color: {v['color']}, hex: {v['hex']}, tags: {v['tags']} }},"
        )
    lines.append("};")
    return "\n".join(lines)


def patch_app_jsx(new_block: str) -> None:
    src = APP_JSX.read_text()
    # Match from 'const BAR_STATS = {' to the closing '};'
    pattern = re.compile(r'const BAR_STATS = \{.*?\};', re.DOTALL)
    m = pattern.search(src)
    if not m:
        sys.exit("Could not find BAR_STATS block in App.jsx")
    old_block = m.group(0)
    if old_block == new_block:
        print("App.jsx BAR_STATS is already up to date — no changes needed.")
        return
    new_src = src[:m.start()] + new_block + src[m.end():]
    APP_JSX.write_text(new_src)
    print(f"Patched {APP_JSX}")


def show_diff(old: str, new: str) -> None:
    import difflib
    old_lines = old.splitlines(keepends=True)
    new_lines = new.splitlines(keepends=True)
    diff = list(difflib.unified_diff(old_lines, new_lines, fromfile="App.jsx (current)", tofile="App.jsx (scraped)"))
    if diff:
        print("".join(diff))
    else:
        print("No differences — cache matches current App.jsx.")


def main():
    write_mode = "--write" in sys.argv
    cache = load_cache()
    new_block = build_bar_stats_block(cache)

    src = APP_JSX.read_text()
    pattern = re.compile(r'const BAR_STATS = \{.*?\};', re.DOTALL)
    m = pattern.search(src)
    old_block = m.group(0) if m else "(not found)"

    print("=== Scraped BAR_STATS ===")
    print(new_block)
    print()
    print("=== Diff vs current App.jsx ===")
    show_diff(old_block, new_block)

    if write_mode:
        patch_app_jsx(new_block)
    else:
        print("\nRun with --write to patch App.jsx.")


if __name__ == "__main__":
    main()
