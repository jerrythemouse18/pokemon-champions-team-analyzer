#!/usr/bin/env python3
"""Download Pokemon sprites for the roster into sprites/ (self-hosted).

Source: Pokemon Showdown's gen5 static sprite set (96x96 PNG), which already
includes most Champions-exclusive Mega forms. Forms without their own sprite
fall back to their base form; the mapping is written to data/sprites.js.

Usage:
    python3 scripts/fetch_sprites.py
"""
import json
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "sprites"
OUT_JS = ROOT / "data" / "sprites.js"
BASE = "https://play.pokemonshowdown.com/sprites/gen5"

# App name -> Showdown sprite id, where mechanical conversion isn't enough.
OVERRIDES = {
    "Meowstic-M": "meowstic",
    "Meowstic-F": "meowstic-f",
    "Meowstic-M-Mega": "meowstic",     # no mega sprite; base male form
    "Meowstic-F-Mega": "meowstic-f",
    "Basculegion-F": "basculegion-f",
    "Maushold-Four": "maushold",
    "Sinistcha-Masterpiece": "sinistcha",
    "Polteageist-Antique": "polteageist",
    "Vivillon-Fancy": "vivillon-fancy",
    "Vivillon-Pokeball": "vivillon-pokeball",
    "Floette-Eternal": "floette-eternal",
    "Floette-Mega": "floette-eternal",
    "Gourgeist-Large": "gourgeist-large",
    "Gourgeist-Small": "gourgeist-small",
    "Gourgeist-Super": "gourgeist-super",
    "Aegislash-Blade": "aegislash-blade",
    "Mimikyu-Busted": "mimikyu-busted",
    "Morpeko-Hangry": "morpeko-hangry",
    "Palafin-Hero": "palafin-hero",
    "Castform-Rainy": "castform-rainy",
    "Castform-Sunny": "castform-sunny",
    "Castform-Snowy": "castform-snowy",
}


def load_roster():
    js = (ROOT / "data" / "pokemon.js").read_text()
    m = re.search(r"const POKEMON_DATA = (\[.*?\]);", js, re.S)
    return json.loads(m.group(1))


def sprite_id(name):
    if name in OVERRIDES:
        return OVERRIDES[name]
    # Showdown ids: lowercase; first hyphen (form separator) kept, rest of the
    # form squashed: "Tauros-Paldea-Aqua" -> "tauros-paldeaaqua",
    # "Raichu-Mega-X" -> "raichu-megax", "Kommo-o" -> "kommoo".
    n = name.lower().replace("’", "").replace("'", "").replace(".", "").replace(": ", "-").replace(" ", "")
    parts = n.split("-")
    if len(parts) == 1:
        return parts[0]
    base_two = {"kommo-o", "ho-oh", "porygon-z", "jangmo-o", "hakamo-o", "wo-chien",
                "chien-pao", "ting-lu", "chi-yu"}
    if "-".join(parts[:2]) in base_two:
        head, tail = "".join(parts[:2]), parts[2:]
    else:
        head, tail = parts[0], parts[1:]
    return head + ("-" + "".join(tail) if tail else "")


def base_form(name):
    m = re.match(r"^(.*)-Mega(?:-[XY])?$", name)
    return m.group(1) if m else None


def fetch(sid):
    path = OUT_DIR / f"{sid}.png"
    if path.exists():
        return True
    url = f"{BASE}/{sid}.png"
    req = urllib.request.Request(url, headers={"User-Agent": "champions-team-analyzer"})
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
        path.write_bytes(data)
        time.sleep(0.15)
        return True
    except Exception:
        return False


def main():
    OUT_DIR.mkdir(exist_ok=True)
    roster = load_roster()
    mapping, missing = {}, []

    for p in roster:
        name = p["name"]
        sid = sprite_id(name)
        if fetch(sid):
            mapping[name] = sid
            continue
        # fall back to base form for megas without a sprite
        base = base_form(name)
        if base:
            bid = sprite_id(base)
            if fetch(bid):
                mapping[name] = bid
                continue
        missing.append(f"{name} ({sid})")

    js = ("// Pokemon name -> self-hosted sprite file (sprites/<id>.png).\n"
          "// Source: Pokemon Showdown gen5 sprites; megas without art use base form.\n"
          "const SPRITE_IDS = " + json.dumps(mapping, separators=(",", ":")) + ";\n")
    OUT_JS.write_text(js)

    n_files = len(list(OUT_DIR.glob("*.png")))
    print(f"mapped {len(mapping)}/{len(roster)} mons -> {n_files} sprite files")
    if missing:
        print("MISSING:", missing)


if __name__ == "__main__":
    main()
