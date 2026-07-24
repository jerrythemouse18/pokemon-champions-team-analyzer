#!/usr/bin/env python3
"""Generate data/learnsets.js — per-Pokemon legal moves in Champions.

Fetches each roster Pokemon's learnset from Smogon's dex RPC
(https://www.smogon.com/dex/_rpc/dump-pokemon). Mega Evolutions and other
battle-only forms aren't separate dex entries (their pages redirect to the
base form), so they are mapped to the base form's learnset app-side; the
output only stores learnsets for base (dex-page) forms plus an alias table.

Requires data/pokemon.js to exist (run extract_data.py first).

Usage:
    python3 scripts/extract_learnsets.py
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "learnsets.js"
RPC = "https://www.smogon.com/dex/_rpc/dump-pokemon"

# App form name -> base dex form whose learnset it uses: battle-only forms,
# cosmetic/size forms without their own dex page, and Floette-Mega (the
# roster's only Floette is the Eternal form).
BATTLE_FORM_BASE = {
    "Aegislash-Blade": "Aegislash",
    "Mimikyu-Busted": "Mimikyu",
    "Morpeko-Hangry": "Morpeko",
    "Palafin-Hero": "Palafin",
    "Castform-Rainy": "Castform",
    "Castform-Sunny": "Castform",
    "Castform-Snowy": "Castform",
    "Gourgeist-Large": "Gourgeist",
    "Gourgeist-Small": "Gourgeist",
    "Gourgeist-Super": "Gourgeist",
    "Maushold-Four": "Maushold",
    "Polteageist-Antique": "Polteageist",
    "Sinistcha-Masterpiece": "Sinistcha",
    "Vivillon-Fancy": "Vivillon",
    "Vivillon-Pokeball": "Vivillon",
    "Floette-Mega": "Floette-Eternal",
}


def load_roster():
    js = (ROOT / "data" / "pokemon.js").read_text()
    m = re.search(r"const POKEMON_DATA = (\[.*?\]);", js, re.S)
    return json.loads(m.group(1))


def base_form(name):
    """Strip -Mega(-X/Y) suffixes; map battle-only forms to their base."""
    if name in BATTLE_FORM_BASE:
        return BATTLE_FORM_BASE[name]
    m = re.match(r"^(.*)-Mega(?:-[XY])?$", name)
    return m.group(1) if m else name


def slug(name):
    return re.sub(r"[^a-z0-9-]", "", name.lower().replace(" ", "-").replace(".", "").replace("'", "").replace(":", ""))


def fetch_learnset(alias):
    body = json.dumps({"gen": "champions", "alias": alias, "language": "en"}).encode()
    req = urllib.request.Request(
        RPC, data=body,
        headers={"Content-Type": "application/json",
                 "User-Agent": "champions-team-analyzer data refresh"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode()).get("learnset") or []


def main():
    roster = load_roster()
    bases = sorted({base_form(p["name"]) for p in roster})
    print(f"{len(roster)} roster mons -> {len(bases)} base forms to fetch")

    learnsets, failed = {}, []
    for i, name in enumerate(bases, 1):
        try:
            ls = fetch_learnset(slug(name))
            if ls:
                learnsets[name] = ls
            else:
                failed.append(name)
        except Exception as e:
            failed.append(f"{name} ({e})")
        if i % 25 == 0:
            print(f"  {i}/{len(bases)} fetched...")
        time.sleep(0.25)  # be polite to Smogon

    if failed:
        print("FAILED (no learnset):", failed)
    if len(failed) > len(bases) * 0.05:
        sys.exit("too many failures — aborting without writing output")

    aliases = {p["name"]: base_form(p["name"]) for p in roster
               if base_form(p["name"]) != p["name"]}

    js = (
        "// Per-Pokemon legal moves in Champions — from Smogon dex RPC dump-pokemon.\n"
        "// Megas/battle forms use their base form's learnset (LEARNSET_ALIASES).\n"
        "const LEARNSETS = " + json.dumps(learnsets, separators=(",", ":")) + ";\n"
        "const LEARNSET_ALIASES = " + json.dumps(aliases, separators=(",", ":")) + ";\n"
    )
    OUT.write_text(js)
    total_moves = sum(len(v) for v in learnsets.values())
    print(f"wrote {len(learnsets)} learnsets ({total_moves} move entries), "
          f"{len(aliases)} aliases -> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
