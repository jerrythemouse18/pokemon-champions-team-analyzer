#!/usr/bin/env python3
"""Regenerate data/pokemon.js from the Smogon Champions dex.

The dex page embeds its full roster as JSON inside a `dexSettings = {...}`
script block. Usage:

    curl -s "https://www.smogon.com/dex/champions/pokemon/" -o /tmp/champions.html
    python3 scripts/extract_data.py [/tmp/champions.html]
"""
import json
import sys
from pathlib import Path

HTML_PATH = sys.argv[1] if len(sys.argv) > 1 else "/tmp/champions.html"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "pokemon.js"

html = Path(HTML_PATH).read_text()
start = html.index("dexSettings = ") + len("dexSettings = ")
obj, _ = json.JSONDecoder().raw_decode(html[start:])

pokemon = None
for key, val in obj["injectRpcs"]:
    if "dump-basics" in key:
        pokemon = val["pokemon"]
        break
if pokemon is None:
    sys.exit("dump-basics RPC not found in page — Smogon may have changed their format")

out = []
for p in sorted(pokemon, key=lambda x: x["name"].lower()):
    out.append({
        "name": p["name"],
        "types": p["types"],
        "abilities": p["abilities"],
        "stats": {"hp": p["hp"], "atk": p["atk"], "def": p["def"],
                  "spa": p["spa"], "spd": p["spd"], "spe": p["spe"]},
        "tier": p["formats"][0] if p["formats"] else "Unranked",
        "dex": p["oob"]["dex_number"] if p.get("oob") else None,
    })

js = "// Pokemon Champions roster — extracted from https://www.smogon.com/dex/champions/pokemon/\n"
js += f"// {len(out)} Pokemon incl. Champions-exclusive Mega Evolutions and regional forms.\n"
js += "const POKEMON_DATA = " + json.dumps(out, separators=(",", ":")) + ";\n"
OUT_PATH.write_text(js)
print(f"Wrote {len(out)} Pokemon to {OUT_PATH}")
