#!/usr/bin/env python3
"""
Fetch Armada, Cortex, and Legion unit definitions from the BAR GitHub repo
(Lua source) and write a JSON cache to tools/cache/bar_units_raw.json.

Run from project root:
    python3 tools/scrape_bar_units.py

The cache is gitignored; run this whenever you want fresh upstream data.
Output keys: {faction}_{type}  e.g. Arm_Wind, Cor_Solar, Leg_Fusion
"""

import json
import re
import sys
import time
import urllib.request
from pathlib import Path

REPO_RAW = "https://raw.githubusercontent.com/beyond-all-reason/Beyond-All-Reason/master"

# (github_subpath, lua_unit_name)
FACTIONS: dict[str, dict[str, tuple[str, str]]] = {
    "Arm": {
        # Energy generators
        "Wind":     ("units/ArmBuildings/LandEconomy/armwin.lua",    "armwin"),
        "Tidal":    ("units/ArmBuildings/SeaEconomy/armtide.lua",    "armtide"),
        "Solar":    ("units/ArmBuildings/LandEconomy/armsolar.lua",  "armsolar"),
        "AdvSolar": ("units/ArmBuildings/LandEconomy/armadvsol.lua", "armadvsol"),
        "Geo":      ("units/ArmBuildings/LandEconomy/armgeo.lua",    "armgeo"),
        "Fusion":   ("units/ArmBuildings/LandEconomy/armfus.lua",    "armfus"),
        "AdvGeo":   ("units/ArmBuildings/LandEconomy/armageo.lua",   "armageo"),
        "UWFusion": ("units/ArmBuildings/SeaEconomy/armuwfus.lua",   "armuwfus"),
        "AFUS":     ("units/ArmBuildings/LandEconomy/armafus.lua",   "armafus"),
        # Metal extractors
        "Mex":      ("units/ArmBuildings/LandEconomy/armmex.lua",    "armmex"),
        "Moho":     ("units/ArmBuildings/LandEconomy/armmoho.lua",   "armmoho"),
        # Storage
        "EStor":    ("units/ArmBuildings/LandEconomy/armestor.lua",  "armestor"),
        "MStor":    ("units/ArmBuildings/LandEconomy/armmstor.lua",  "armmstor"),
        # Constructors (mobile)
        "ConK":     ("units/ArmBots/armck.lua",           "armck"),
        "ConV":     ("units/ArmVehicles/armcv.lua",       "armcv"),
        "ConKT2":   ("units/ArmBots/T2/armack.lua",       "armack"),
        "ConVT2":   ("units/ArmVehicles/T2/armacv.lua",   "armacv"),
        # Construction buildings (nanolathe turrets)
        "Nano":     ("units/ArmBuildings/LandUtil/armnanotc.lua",   "armnanotc"),
        # Construction aircraft
        "ConA":     ("units/ArmAircraft/armca.lua",                 "armca"),
        # Fast/vehicle combat constructors
        "Butler":   ("units/ArmBots/T2/armfark.lua",                "armfark"),
        "Consul":   ("units/ArmVehicles/T2/armconsul.lua",          "armconsul"),
        # Factories T1
        "T1Lab":    ("units/ArmBuildings/LandFactories/armlab.lua", "armlab"),
        "T1Veh":    ("units/ArmBuildings/LandFactories/armvp.lua",  "armvp"),
        "T1Air":    ("units/ArmBuildings/LandFactories/armap.lua",  "armap"),
        "T1Hover":  ("units/ArmBuildings/LandFactories/armhp.lua",  "armhp"),
        # Factories T2
        "T2Lab":    ("units/ArmBuildings/LandFactories/armalab.lua","armalab"),
        "T2Veh":    ("units/ArmBuildings/LandFactories/armavp.lua", "armavp"),
        "T2Air":    ("units/ArmBuildings/LandFactories/armaap.lua", "armaap"),
    },
    "Cor": {
        # Energy generators
        "Wind":     ("units/CorBuildings/LandEconomy/corwin.lua",    "corwin"),
        "Tidal":    ("units/CorBuildings/SeaEconomy/cortide.lua",    "cortide"),
        "Solar":    ("units/CorBuildings/LandEconomy/corsolar.lua",  "corsolar"),
        "AdvSolar": ("units/CorBuildings/LandEconomy/coradvsol.lua", "coradvsol"),
        "Geo":      ("units/CorBuildings/LandEconomy/corgeo.lua",    "corgeo"),
        "Fusion":   ("units/CorBuildings/LandEconomy/corfus.lua",    "corfus"),
        "AdvGeo":   ("units/CorBuildings/LandEconomy/corageo.lua",   "corageo"),
        "UWFusion": ("units/CorBuildings/SeaEconomy/coruwfus.lua",   "coruwfus"),
        "AFUS":     ("units/CorBuildings/LandEconomy/corafus.lua",   "corafus"),
        # Metal extractors
        "Mex":      ("units/CorBuildings/LandEconomy/cormex.lua",    "cormex"),
        "Moho":     ("units/CorBuildings/LandEconomy/cormoho.lua",   "cormoho"),
        # Storage
        "EStor":    ("units/CorBuildings/LandEconomy/corestor.lua",  "corestor"),
        "MStor":    ("units/CorBuildings/LandEconomy/cormstor.lua",  "cormstor"),
        # Constructors (mobile)
        "ConK":     ("units/CorBots/corck.lua",           "corck"),
        "ConV":     ("units/CorVehicles/corcv.lua",       "corcv"),
        "ConKT2":   ("units/CorBots/T2/corack.lua",       "corack"),
        "ConVT2":   ("units/CorVehicles/T2/coracv.lua",   "coracv"),
        # Construction buildings (nanolathe turrets)
        "Nano":     ("units/CorBuildings/LandUtil/cornanotc.lua",   "cornanotc"),
        # Construction aircraft
        "ConA":     ("units/CorAircraft/corca.lua",                 "corca"),
        # Fast/vehicle combat constructors
        "Twitcher": ("units/CorBots/T2/corfast.lua",                "corfast"),
        "Consul":   ("units/CorVehicles/T2/corprinter.lua",         "corprinter"),
        # Factories T1
        "T1Lab":    ("units/CorBuildings/LandFactories/corlab.lua", "corlab"),
        "T1Veh":    ("units/CorBuildings/LandFactories/corvp.lua",  "corvp"),
        "T1Air":    ("units/CorBuildings/LandFactories/corap.lua",  "corap"),
        "T1Hover":  ("units/CorBuildings/LandFactories/corhp.lua",  "corhp"),
        # Factories T2
        "T2Lab":    ("units/CorBuildings/LandFactories/coralab.lua","coralab"),
        "T2Veh":    ("units/CorBuildings/LandFactories/coravp.lua", "coravp"),
        "T2Air":    ("units/CorBuildings/LandFactories/coraap.lua", "coraap"),
    },
    "Leg": {
        # Energy generators
        "Wind":     ("units/Legion/Economy/legwin.lua",       "legwin"),
        "Tidal":    ("units/Legion/SeaEconomy/legtide.lua",   "legtide"),
        "Solar":    ("units/Legion/Economy/legsolar.lua",     "legsolar"),
        "AdvSolar": ("units/Legion/Economy/legadvsol.lua",    "legadvsol"),
        "Geo":      ("units/Legion/Economy/leggeo.lua",       "leggeo"),
        "Fusion":   ("units/Legion/Economy/legfus.lua",       "legfus"),
        "AdvGeo":   ("units/Legion/Economy/legageo.lua",      "legageo"),
        # Legion has no naval fusion
        "AFUS":     ("units/Legion/Economy/legafus.lua",      "legafus"),
        # Metal extractors — Legion has an extra T1.5 tier between T1 and moho
        "Mex":      ("units/Legion/Economy/legmex.lua",       "legmex"),
        "MexT15":   ("units/Legion/Economy/legmext15.lua",    "legmext15"),
        "Moho":     ("units/Legion/Economy/legmoho.lua",      "legmoho"),
        # Storage
        "EStor":    ("units/Legion/Economy/legestor.lua",     "legestor"),
        "MStor":    ("units/Legion/Economy/legmstor.lua",     "legmstor"),
        # Constructors (mobile)
        "ConK":     ("units/Legion/Constructors/legck.lua",   "legck"),
        "ConV":     ("units/Legion/Constructors/legcv.lua",   "legcv"),
        "ConKT2":   ("units/Legion/Constructors/legack.lua",  "legack"),
        "ConVT2":   ("units/Legion/Constructors/legacv.lua",  "legacv"),
        # Construction buildings (nanolathe turrets)
        "Nano":     ("units/Legion/Utilities/legnanotc.lua",   "legnanotc"),
        # Construction aircraft
        "ConA":     ("units/Legion/Constructors/legca.lua",    "legca"),
        # Fast/vehicle combat constructors
        "FastCon":  ("units/Legion/Constructors/leghack.lua",  "leghack"),
        "Consul":   ("units/Legion/Constructors/legafcv.lua",  "legafcv"),
        # Factories T1
        "T1Lab":    ("units/Legion/Labs/leglab.lua",           "leglab"),
        "T1Veh":    ("units/Legion/Labs/legvp.lua",            "legvp"),
        "T1Air":    ("units/Legion/Labs/legap.lua",            "legap"),
        "T1Hover":  ("units/Legion/Labs/leghp.lua",            "leghp"),
        # Factories T2
        "T2Lab":    ("units/Legion/Labs/legalab.lua",          "legalab"),
        "T2Veh":    ("units/Legion/Labs/legavp.lua",           "legavp"),
        "T2Air":    ("units/Legion/Labs/legaap.lua",           "legaap"),
    },
}

SCALAR_FIELDS = {
    "metalcost", "energycost", "buildtime",
    "energyupkeep",    # negative = production; positive = energy drain (mexes)
    "energymake",      # explicit production
    "windgenerator",   # presence = variable wind unit
    "tidalgenerator",  # presence = variable tidal unit (value is a flag, not E/s)
    "extractsmetal",   # metal extraction rate multiplier (mexes)
    "energystorage",   # energy storage capacity (storage buildings)
    "metalstorage",    # metal storage capacity (storage buildings)
    "workertime",      # build power provided (constructors, nanolathe turrets)
}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "bar-eco-manifold-scraper/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.read().decode("utf-8")


def parse_lua_unit(lua_src: str, unit_name: str) -> dict:
    """
    Extract scalar fields from the top-level unit table in a BAR Lua unit def.
    Skips nested brace blocks (customparams, featuredefs, sounds, etc.).
    """
    header_pattern = re.compile(
        rf'\b{re.escape(unit_name)}\s*=\s*\{{', re.IGNORECASE
    )
    m = header_pattern.search(lua_src)
    if not m:
        raise ValueError(f"Unit '{unit_name}' table not found")

    depth = 1
    top_level_lines: list[str] = []
    line_buf: list[str] = []
    chars = lua_src[m.end():]

    for ch in chars:
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                break
        if depth == 1:
            if ch == '\n':
                top_level_lines.append(''.join(line_buf))
                line_buf = []
            else:
                line_buf.append(ch)

    result: dict = {}
    kv_pattern = re.compile(r'^\s*(\w+)\s*=\s*(-?[\d.]+)\s*,?\s*(?:--.*)?$')
    for line in top_level_lines:
        m2 = kv_pattern.match(line)
        if m2:
            key = m2.group(1).lower()
            if key in SCALAR_FIELDS:
                result[key] = float(m2.group(2))
    return result


def derive_energy_output(raw: dict) -> float | None:
    """
    Normalise to a fixed E/s value, or None for map-variable units.

    - energymake = N        → N E/s
    - energyupkeep = -N     → N E/s (negative upkeep = production)
    - windgenerator / tidalgenerator → variable, no fixed output → None
    """
    if "energymake" in raw and raw["energymake"] > 0:
        return raw["energymake"]
    if "energyupkeep" in raw and raw["energyupkeep"] < 0:
        return -raw["energyupkeep"]
    return None  # wind / tidal: variable output, map-dependent


def main():
    cache_path = Path(__file__).parent / "cache" / "bar_units_raw.json"
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    results: dict = {}
    errors: list[str] = []

    for faction, units in FACTIONS.items():
        print(f"\n── {faction} {'─'*50}")
        for unit_type, (path, lua_name) in units.items():
            key = f"{faction}_{unit_type}"
            url = f"{REPO_RAW}/{path}"
            print(f"  {key:<20}  ", end="", flush=True)
            try:
                src = fetch(url)
                raw = parse_lua_unit(src, lua_name)
                output = derive_energy_output(raw)
                variable = "windgenerator" in raw or "tidalgenerator" in raw
                results[key] = {
                    "faction":   faction,
                    "unit_type": unit_type,
                    "lua_name":  lua_name,
                    "lua_path":  path,
                    "raw":       raw,
                    "derived": {
                        "m":       int(raw.get("metalcost", 0)),
                        "e":       int(raw.get("energycost", 0)),
                        "l":       int(raw.get("buildtime", 0)),
                        "o":       int(output) if output is not None else None,
                        "variable": variable,
                        "eStore":  int(raw["energystorage"]) if raw.get("energystorage", 0) > 0 else None,
                        "mStore":  int(raw["metalstorage"])  if raw.get("metalstorage",  0) > 0 else None,
                        "bp":      int(raw["workertime"])    if raw.get("workertime",     0) > 0 else None,
                    },
                }
                d = results[key]["derived"]
                extras = ""
                if d["eStore"]: extras += f"  eStore={d['eStore']}"
                if d["mStore"]: extras += f"  mStore={d['mStore']}"
                if d["bp"]:     extras += f"  bp={d['bp']}"
                print(f"m={d['m']:>6}  e={d['e']:>6}  l={d['l']:>7}"
                      f"  o={str(d['o']):>5}  var={d['variable']}{extras}")
            except Exception as exc:
                print(f"ERROR: {exc}", file=sys.stderr)
                errors.append(f"{key}: {exc}")
            time.sleep(0.25)

    cache_path.write_text(json.dumps(results, indent=2))
    print(f"\nWrote {len(results)} units to {cache_path}")
    if errors:
        print(f"\n{len(errors)} error(s):", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
