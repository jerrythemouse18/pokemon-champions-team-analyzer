#!/usr/bin/env python3
"""Generate data/movesets.js from Smogon usage stats + the Champions dex.

Sources:
  1. Smogon chaos JSON for the Champions VGC doubles ladder (primary) and the
     4v4 doubles UU ladder (fallback for mons unranked in VGC):
       https://www.smogon.com/stats/<YYYY-MM>/chaos/gen9championsvgc2026regmb-1760.json
       https://www.smogon.com/stats/<YYYY-MM>/chaos/gen9champions4v4doublesuu-1630.json
  2. Move metadata (type/category/power) from the dexSettings JSON embedded in
     any Champions dex page (same source as extract_data.py).

Output per Pokemon: top moves with doubles usage %, plus the most common
item / ability / spread. Champions spreads use a 0-32 unit scale; they are
converted to the 0-252 EV scale the app and @smogon/calc expect (unit * 8,
capped at 252).

Usage:
    python3 scripts/extract_movesets.py [YYYY-MM]   # default: latest complete month
"""
import json
import re
import sys
import urllib.request
from pathlib import Path

MONTH = sys.argv[1] if len(sys.argv) > 1 else "2026-06"
PRIMARY = f"https://www.smogon.com/stats/{MONTH}/chaos/gen9championsvgc2026regmb-1760.json"
FALLBACK = f"https://www.smogon.com/stats/{MONTH}/chaos/gen9champions4v4doublesuu-1630.json"
DEX_PAGE = "https://www.smogon.com/dex/champions/pokemon/gholdengo/"

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "movesets.js"

TOP_MOVES = 10   # moves kept per pokemon
MIN_PCT = 2.0    # drop moves below this usage %


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "champions-team-analyzer data refresh"})
    with urllib.request.urlopen(req) as r:
        return r.read().decode()


def toid(s):
    return "".join(c for c in s.lower() if c.isalnum())


def load_dex_moves():
    html = fetch(DEX_PAGE)
    start = html.index("dexSettings = ") + len("dexSettings = ")
    obj, _ = json.JSONDecoder().raw_decode(html[start:])
    for key, val in obj["injectRpcs"]:
        if "dump-basics" in key:
            moves = {toid(m["name"]): m for m in val["moves"]}
            items = {toid(i["name"]): i["name"] for i in val["items"]}
            return moves, items
    sys.exit("dump-basics RPC not found on dex page")


def spread_to_evs(spread):
    """'Modest:2/0/0/32/0/32' -> (nature, {stat: ev252})."""
    nature, units = spread.split(":")
    keys = ["hp", "atk", "def", "spa", "spd", "spe"]
    evs = {}
    for k, u in zip(keys, (int(x) for x in units.split("/"))):
        if u:
            evs[k] = min(252, u * 8)
    return nature, evs


def best(counter):
    """Highest-weight key of a chaos counter dict, or None."""
    items = [(k, v) for k, v in counter.items() if k and k != "nothing"]
    return max(items, key=lambda kv: kv[1])[0] if items else None


def extract(chaos_data, dex_moves, dex_items, source):
    out = {}
    for name, d in chaos_data.items():
        raw = d.get("Raw count", 0)
        if not raw or not d.get("Moves"):
            continue
        move_total = sum(d["Moves"].values())
        if not move_total:
            continue
        # Move usage: counts are per-slot (4 slots), so pct of teams = count/total*400.
        moves = []
        for mid, cnt in sorted(d["Moves"].items(), key=lambda kv: -kv[1]):
            if not mid or mid not in dex_moves:
                continue
            pct = cnt / move_total * 400
            if pct < MIN_PCT or len(moves) >= TOP_MOVES:
                continue
            moves.append({"name": dex_moves[mid]["name"], "pct": round(pct, 1)})
        if not moves:
            continue

        entry = {"moves": moves, "source": source}
        item_id = best(d.get("Items", {}))
        if item_id and item_id in dex_items:
            entry["item"] = dex_items[item_id]
        spread = best(d.get("Spreads", {}))
        if spread:
            nature, evs = spread_to_evs(spread)
            entry["nature"] = nature
            entry["evs"] = evs
        ability = best(d.get("Abilities", {}))
        if ability:
            entry["ability"] = ability  # chaos id form, resolved app-side
        entry["usage"] = round(d.get("usage", 0) * 100, 2)
        out[name] = entry
    return out


def main():
    dex_moves, dex_items = load_dex_moves()

    primary = json.loads(fetch(PRIMARY))
    fallback = json.loads(fetch(FALLBACK))
    print(f"primary  {primary['info']['metagame']}: {primary['info']['number of battles']} battles")
    print(f"fallback {fallback['info']['metagame']}: {fallback['info']['number of battles']} battles")

    sets = extract(primary["data"], dex_moves, dex_items, "vgc")
    fb = extract(fallback["data"], dex_moves, dex_items, "uu")
    for name, entry in fb.items():
        if name not in sets:
            sets[name] = entry

    # Trimmed move metadata for every move referenced by any set (plus all
    # damaging moves, for the editor's move picker and coverage math).
    used = {toid(m["name"]) for e in sets.values() for m in e["moves"]}
    meta = {}
    for mid, m in dex_moves.items():
        if mid in used or m["category"] != "Non-Damaging":
            meta[m["name"]] = {
                "type": m["type"],
                "cat": m["category"],       # Physical | Special | Non-Damaging
                "power": m["power"],
                "acc": m["accuracy"],
                "target": m["target"],
            }

    js = (
        f"// Doubles moveset usage for Pokemon Champions - generated {MONTH} from Smogon stats.\n"
        f"// Primary: {PRIMARY}\n"
        f"// Fallback: {FALLBACK}\n"
        f"// Spreads converted from Champions 0-32 units to 0-252 EVs (x8, cap 252).\n"
        "const MOVESET_DATA = " + json.dumps(sets, separators=(",", ":")) + ";\n"
        "const MOVE_META = " + json.dumps(meta, separators=(",", ":")) + ";\n"
    )
    OUT.write_text(js)
    print(f"wrote {len(sets)} movesets ({sum(1 for e in sets.values() if e['source']=='vgc')} vgc, "
          f"{sum(1 for e in sets.values() if e['source']=='uu')} uu fallback), "
          f"{len(meta)} move metadata entries -> {OUT} ({OUT.stat().st_size//1024} KB)")


if __name__ == "__main__":
    main()
