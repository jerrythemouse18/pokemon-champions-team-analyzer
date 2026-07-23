# Data provenance

`pokemon.js` holds the full Pokémon Champions roster as shown on the
[Smogon Champions Strategy Pokedex](https://www.smogon.com/dex/champions/pokemon/),
extracted **July 2026** — 323 Pokémon.

Per Pokémon: name, types, abilities, base stats, Smogon tier (`Uber`, `OU`,
`UUBL`, `UU`, `NFE`), and national dex number.

Notable roster facts (as extracted):
- Includes ~120 alternate forms: Champions-exclusive **Mega Evolutions**
  (Mega Garchomp, Mega Meganium, Mega Feraligatr, Mega Raichu X/Y, …),
  regional forms (Alola/Galar/Hisui/Paldea), and cosmetic/battle forms.
- Tier distribution: 8 Uber, 74 OU, 4 UUBL, 236 UU, 1 NFE.

## Refreshing

```bash
curl -s "https://www.smogon.com/dex/champions/pokemon/" -o /tmp/champions.html
python3 scripts/extract_data.py
```

The extractor parses the `dexSettings` JSON blob embedded in the page (the
site is a JS app; the data ships inline). If Smogon changes their page
structure the script fails loudly rather than writing partial data.
