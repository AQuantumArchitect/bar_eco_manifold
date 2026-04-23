#!/usr/bin/env python3
"""
Read the scraped unit cache and generate the BAR_STATS JS block for App.jsx.

Run from project root:
    python3 tools/gen_bar_stats.py           # print diff only
    python3 tools/gen_bar_stats.py --write   # patch App.jsx in-place
"""

import json
import re
import sys
from pathlib import Path

CACHE = Path(__file__).parent / "cache" / "bar_units_raw.json"
APP_JSX = Path(__file__).parent.parent / "src" / "App.jsx"

# ── Visual config (not in game data) ────────────────────────────────────────
# Armada: existing mixed palette per unit type
# Cortex: red-orange family  (T1 light → T2 dark)
# Legion: teal-green family  (T1 light → T2 dark)
# Mexes:  gold/amber/olive earth tones
# Storage: blue-grey (energy) / brown (metal)
# Constructors: warm orange family

VISUAL: dict[str, dict[str, dict]] = {
    "Arm": {
        "Wind":     {"hex": "#4CAF50", "tags": "['t1', 'land', 'variable', 'armada']"},
        "Tidal":    {"hex": "#00BCD4", "tags": "['t1', 'naval', 'variable', 'armada']"},
        "Solar":    {"hex": "#FDD835", "tags": "['t1', 'land', 'armada']"},
        "AdvSolar": {"hex": "#FF9800", "tags": "['t1', 'land', 'armada']"},
        "Geo":      {"hex": "#E91E63", "tags": "['t1', 'land', 'georeq', 'armada']"},
        "Fusion":   {"hex": "#2196F3", "tags": "['t2', 'land', 'armada']"},
        "AdvGeo":   {"hex": "#F44336", "tags": "['t2', 'land', 'georeq', 'armada']"},
        "UWFusion": {"hex": "#3F51B5", "tags": "['t2', 'naval', 'armada']"},
        "AFUS":     {"hex": "#9C27B0", "tags": "['t2', 'land', 'armada']"},
        "Mex":      {"hex": "#FFD54F", "tags": "['t1', 'land', 'mex', 'armada']"},
        "Moho":     {"hex": "#FF8F00", "tags": "['t2', 'land', 'mex', 'armada']"},
        "EStor":    {"hex": "#78909C", "tags": "['t1', 'land', 'estor', 'armada']"},
        "MStor":    {"hex": "#8D6E63", "tags": "['t1', 'land', 'mstor', 'armada']"},
        "ConK":     {"hex": "#FF7043", "tags": "['t1', 'land', 'constructor', 'armada']"},
        "ConV":     {"hex": "#FF5722", "tags": "['t1', 'land', 'constructor', 'armada']"},
    },
    "Cor": {
        "Wind":     {"hex": "#EF9A9A", "tags": "['t1', 'land', 'variable', 'cortex']"},
        "Tidal":    {"hex": "#FFAB91", "tags": "['t1', 'naval', 'variable', 'cortex']"},
        "Solar":    {"hex": "#EF5350", "tags": "['t1', 'land', 'cortex']"},
        "AdvSolar": {"hex": "#E53935", "tags": "['t1', 'land', 'cortex']"},
        "Geo":      {"hex": "#C62828", "tags": "['t1', 'land', 'georeq', 'cortex']"},
        "Fusion":   {"hex": "#BF360C", "tags": "['t2', 'land', 'cortex']"},
        "AdvGeo":   {"hex": "#B71C1C", "tags": "['t2', 'land', 'georeq', 'cortex']"},
        "UWFusion": {"hex": "#880E4F", "tags": "['t2', 'naval', 'cortex']"},
        "AFUS":     {"hex": "#4A148C", "tags": "['t2', 'land', 'cortex']"},
        "Mex":      {"hex": "#FFCA28", "tags": "['t1', 'land', 'mex', 'cortex']"},
        "Moho":     {"hex": "#F57C00", "tags": "['t2', 'land', 'mex', 'cortex']"},
        "EStor":    {"hex": "#546E7A", "tags": "['t1', 'land', 'estor', 'cortex']"},
        "MStor":    {"hex": "#795548", "tags": "['t1', 'land', 'mstor', 'cortex']"},
        "ConK":     {"hex": "#FF8A65", "tags": "['t1', 'land', 'constructor', 'cortex']"},
        "ConV":     {"hex": "#FF6E40", "tags": "['t1', 'land', 'constructor', 'cortex']"},
    },
    "Leg": {
        "Wind":     {"hex": "#80CBC4", "tags": "['t1', 'land', 'variable', 'legion']"},
        "Tidal":    {"hex": "#80DEEA", "tags": "['t1', 'naval', 'variable', 'legion']"},
        "Solar":    {"hex": "#26C6DA", "tags": "['t1', 'land', 'legion']"},
        "AdvSolar": {"hex": "#00ACC1", "tags": "['t1', 'land', 'legion']"},
        "Geo":      {"hex": "#00838F", "tags": "['t1', 'land', 'georeq', 'legion']"},
        "Fusion":   {"hex": "#006064", "tags": "['t2', 'land', 'legion']"},
        "AdvGeo":   {"hex": "#004D40", "tags": "['t2', 'land', 'georeq', 'legion']"},
        "AFUS":     {"hex": "#1B5E20", "tags": "['t2', 'land', 'legion']"},
        "Mex":      {"hex": "#D4E157", "tags": "['t1', 'land', 'mex', 'legion']"},
        "MexT15":   {"hex": "#AFB42B", "tags": "['t1', 'land', 'mex', 'legion']"},
        "Moho":     {"hex": "#827717", "tags": "['t2', 'land', 'mex', 'legion']"},
        "EStor":    {"hex": "#455A64", "tags": "['t1', 'land', 'estor', 'legion']"},
        "MStor":    {"hex": "#4E342E", "tags": "['t1', 'land', 'mstor', 'legion']"},
    },
}

FACTION_LABELS = {"Arm": "Arm.", "Cor": "Cor.", "Leg": "Leg."}

BASE_NAMES = {
    "Wind":     "Wind Turbine",
    "Tidal":    "Tidal Generator",
    "Solar":    "Solar Collector",
    "AdvSolar": "Adv. Solar",
    "Geo":      "Geothermal",
    "Fusion":   "Fusion Reactor",
    "AdvGeo":   "Adv. Geothermal",
    "UWFusion": "Naval Fusion",
    "AFUS":     "Adv. Fusion",
    "Mex":      "T1 Mex",
    "MexT15":   "T1.5 Mex",
    "Moho":     "Moho Mex",
    "EStor":    "Energy Storage",
    "MStor":    "Metal Storage",
    "ConK":     "Con. Kbot",
    "ConV":     "Con. Vehicle",
}

# extractsmetal for the reference unit (armmex) — all xm values are ratios to this
MEX_BASE_EXTRACTSMETAL = 0.001

# Unit type → display group (controls blank-line separators in output)
MEX_TYPES  = {"Mex", "MexT15", "Moho"}
STOR_TYPES = {"EStor", "MStor"}
CON_TYPES  = {"ConK", "ConV", "ConKT2", "ConVT2", "Nano", "NanoT2"}

def unit_group(unit_type: str) -> str:
    if unit_type in MEX_TYPES:  return "mex"
    if unit_type in STOR_TYPES: return "stor"
    if unit_type in CON_TYPES:  return "con"
    return "gen"

# JS key per faction/type — Armada keeps original keys for compat
def js_key(faction: str, unit_type: str) -> str:
    if faction == "Arm":
        return unit_type
    return f"{faction}{unit_type}"

# Emit order: generators → mexes → storage → constructors
UNIT_ORDER = [
    "Wind", "Tidal", "Solar", "AdvSolar", "Geo", "Fusion", "AdvGeo", "UWFusion", "AFUS",
    "Mex", "MexT15", "Moho",
    "EStor", "MStor",
    "ConK", "ConV", "ConKT2", "ConVT2", "Nano", "NanoT2",
]
FACTION_ORDER = ["Arm", "Cor", "Leg"]


def hex_to_threejs(hex_color: str) -> str:
    return "0x" + hex_color.lstrip("#")


def load_cache() -> dict:
    if not CACHE.exists():
        sys.exit(f"Cache not found: {CACHE}\nRun: python3 tools/scrape_bar_units.py")
    return json.loads(CACHE.read_text())


def build_bar_stats_block(cache: dict) -> str:
    lines = ["const BAR_STATS = {"]
    prev_group = None

    for unit_type in UNIT_ORDER:
        group = unit_group(unit_type)
        if prev_group is not None and group != prev_group:
            lines.append("")  # blank line between groups

        for faction in FACTION_ORDER:
            cache_key = f"{faction}_{unit_type}"
            if cache_key not in cache:
                continue
            if faction not in VISUAL or unit_type not in VISUAL[faction]:
                continue  # no visual config for this faction/type

            d   = cache[cache_key]["derived"]
            raw = cache[cache_key]["raw"]
            v   = VISUAL[faction][unit_type]
            key  = js_key(faction, unit_type)
            name = f"{FACTION_LABELS[faction]} {BASE_NAMES[unit_type]}"
            color = hex_to_threejs(v["hex"])

            # ── income/storage/bp field — depends on unit category ─────────
            if unit_type in MEX_TYPES:
                xm_ratio = round(raw["extractsmetal"] / MEX_BASE_EXTRACTSMETAL, 4)
                energy_bonus = d["o"] if (d["o"] is not None and not d["variable"]) else None
                income_part = (f"xm: {xm_ratio}, o: {energy_bonus}, "
                               if energy_bonus else f"xm: {xm_ratio}, ")
            elif unit_type == "EStor":
                income_part = f"eStore: {d['eStore']}, "
            elif unit_type == "MStor":
                income_part = f"mStore: {d['mStore']}, "
            elif unit_type in CON_TYPES:
                income_part = f"bp: {d['bp']}, "
            else:
                # Regular generator — only emit o if fixed output
                income_part = f"o: {d['o']},   " if (d["o"] is not None and not d["variable"]) else ""

            lines.append(
                f"  {key:<14}: {{ name: {name!r:<27}, "
                f"m: {d['m']:<6}, e: {d['e']:<6}, l: {d['l']:<8}, "
                f"{income_part}"
                f"color: {color}, hex: '{v['hex']}', tags: {v['tags']} }},"
            )
        prev_group = group

    lines.append("};")
    return "\n".join(lines)


def patch_app_jsx(new_block: str) -> None:
    src = APP_JSX.read_text()
    pattern = re.compile(r'const BAR_STATS = \{.*?\};', re.DOTALL)
    m = pattern.search(src)
    if not m:
        sys.exit("Could not find BAR_STATS block in App.jsx")
    if m.group(0) == new_block:
        print("App.jsx BAR_STATS already up to date.")
        return
    APP_JSX.write_text(src[:m.start()] + new_block + src[m.end():])
    print(f"Patched {APP_JSX}")


def show_diff(old: str, new: str) -> None:
    import difflib
    diff = list(difflib.unified_diff(
        old.splitlines(keepends=True), new.splitlines(keepends=True),
        fromfile="App.jsx (current)", tofile="App.jsx (scraped)"
    ))
    print("".join(diff) if diff else "No differences.")


def main():
    write_mode = "--write" in sys.argv
    cache = load_cache()
    new_block = build_bar_stats_block(cache)

    src = APP_JSX.read_text()
    m = re.search(r'const BAR_STATS = \{.*?\};', src, re.DOTALL)
    old_block = m.group(0) if m else "(BAR_STATS not found)"

    print("=== Scraped BAR_STATS ===")
    print(new_block)
    print("\n=== Diff vs current App.jsx ===")
    show_diff(old_block, new_block)

    if write_mode:
        patch_app_jsx(new_block)
    else:
        print("\nRun with --write to patch App.jsx.")


if __name__ == "__main__":
    main()
