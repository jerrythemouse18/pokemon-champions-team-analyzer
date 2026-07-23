# Champions Team Analyzer

A web app for competitive **Pokémon Champions** team building. Pick your 6 Pokémon and instantly see your team's type advantages and disadvantages — defensively, offensively, and against the actual Champions metagame.

**Live app: https://jerrythemouse18.github.io/pokemon-champions-team-analyzer/**

Data source: the [Smogon Champions Strategy Pokedex](https://www.smogon.com/dex/champions/pokemon/) — all **323 Pokémon** in the Champions roster (July 2026), including the Champions-exclusive Mega Evolutions (Mega Garchomp, Mega Feraligatr, Mega Meganium…), regional forms, and Smogon tier placements (Uber / OU / UUBL / UU).

## Running it

Use the hosted version at the link above, or run it locally. No build step, no dependencies — it's a static site:

```bash
# option 1: just open it
open index.html

# option 2: serve it (needed if your browser blocks local file scripts)
python3 -m http.server 8080
# then visit http://localhost:8080
```

## What it does

### 1. Team builder
- Autocomplete search over the full 323-Pokémon Champions dex
- Shows types, tier, ability, and base stats for each pick
- **Ability selector** — abilities that change type matchups (marked ★) are factored into all defensive math: Levitate, Water/Volt Absorb, Flash Fire, Lightning Rod, Motor Drive, Sap Sipper, Earth Eater, Dry Skin, Thick Fat, Heatproof, Fluffy, Water Bubble, Purifying Salt
- Team persists in `localStorage` **and** in the URL hash, so you can bookmark or share a team link

### 2. Team summary
- Flags **stacked weaknesses** (any attacking type that hits 3+ of your members super-effectively)
- Flags **unresisted types** (types nobody on your team resists — every hit lands at least neutral)
- Suggests high-BST Uber/OU/UUBL partners that patch each stacked weakness

### 3. Defensive matrix
An 18-row heatmap: every attacking type vs. every team member, with the exact multiplier (0, ¼, ½, 1, 2, 4×) in each cell and a per-type **weak/resist tally**. Ability modifiers included.

### 4. Offensive STAB coverage
For every defending type, the best multiplier any of your STAB (same-type attack bonus) types achieves — and a list of types you can't hit super-effectively.

### 5. Top threats
Scans the Champions metagame (Uber/OU/UUBL by default, UU toggleable) and ranks Pokémon by threat score:

```
threat score = 2 × (your members it hits super-effectively with STAB)
             + (your STAB types it resists or is immune to)
```

Only Pokémon that hit at least 2 of your members super-effectively are listed.

## Methodology & limitations

- **Type chart**: standard Gen 6+ 18-type chart, as used by Pokémon Champions.
- **STAB-only offense**: the offense and threat analyses assume Pokémon attack with their own types. Real movesets carry coverage moves (e.g. Garchomp's Fire Fang), so treat the threat list as a *type-matchup* baseline, not a full damage calc.
- **Abilities**: only effectiveness-modifying abilities are modeled. Abilities like Intimidate, Unaware, or Good as Gold (move immunity, not damage) are out of scope for a type calculator.
- **Threat scoring for multi-ability threats**: a threat's own defensive ability is only applied when it has exactly one ability (no guessing which one it runs).
- **Data snapshot**: roster and tiers were extracted from Smogon's dex in July 2026. Champions receives roster updates; see `data/README.md` for how to refresh.

## Project structure

```
index.html          app shell
css/style.css       dark theme, heatmap colors (diverging blue = resist / red = weak)
js/typechart.js     18-type chart, type colors, ability modifiers, effectiveness()
js/app.js           team state, autocomplete, analysis rendering, threat scoring
data/pokemon.js     323-Pokémon roster (names, types, abilities, stats, tiers)
data/README.md      how the data was extracted and how to refresh it
```

## Refreshing the data

The Smogon dex embeds its full roster as JSON in the page. To re-extract:

```bash
curl -s "https://www.smogon.com/dex/champions/pokemon/" -o /tmp/champions.html
python3 scripts/extract_data.py   # regenerates data/pokemon.js
```

## Roadmap

See [FEATURES.md](FEATURES.md) for the list of candidate enhancements to choose from.

---

*Unofficial fan tool. Pokémon and Pokémon Champions are trademarks of Nintendo / Creatures Inc. / GAME FREAK Inc. / The Pokémon Company. Roster data courtesy of Smogon.*
