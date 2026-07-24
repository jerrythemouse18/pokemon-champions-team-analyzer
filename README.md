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
- **Auto-filled movesets** — every pick loads its most common competitive doubles set (top-4 moves, item, nature, EV spread, ability) from Champions VGC ladder usage stats (1.16M battles, June 2026); 282 of 323 Pokémon have usage data, the rest start blank
- **Ability selector** — abilities that change type matchups (marked ★) are factored into all defensive math: Levitate, Water/Volt Absorb, Flash Fire, Lightning Rod, Motor Drive, Sap Sipper, Earth Eater, Dry Skin, Thick Fat, Heatproof, Fluffy, Water Bubble, Purifying Salt
- Team persists in `localStorage` **and** in the URL hash, so you can bookmark or share a team link

### 2. Team summary
- **Team archetype detection** — labels your team's playstyle the way competitive players talk about teams: **Rain / Sun / Sand / Snow** (weather setter + abusers + boosted STAB), **Trick Room** (multiple slow, hard-hitting members), **Hyper Offense** (fast heavy hitters, snowball abilities, high team Speed), **Stall / Fat Balance** (bulk + longevity abilities like Regenerator/Unaware), falling back to **Balance** when no specialist signal dominates. Every label shows its evidence, plus secondary tendencies (e.g. "Sand team, with a Trick Room mode"). Detection reads abilities and stats (not the four chosen moves, which can change freely).
- Flags **stacked weaknesses** (any attacking type that hits 3+ of your members super-effectively)
- Flags **unresisted types** (types nobody on your team resists — every hit lands at least neutral)
- Suggests high-BST Uber/OU/UUBL partners that patch each stacked weakness

### 3. Pair compatibility
A 6×6 synergy matrix scoring every pair of teammates: **+1** for each weakness one member has that the other resists (they cover each other), **−2** for each weakness both share (stacked liability). Click any cell for the exact type-by-type breakdown; the Avg column shows each member's mean synergy with the rest of the team — a quick way to spot the odd one out.

### 4. Defensive matrix
An 18-row heatmap: every attacking type vs. every team member, with the exact multiplier (0, ¼, ½, 1, 2, 4×) in each cell and a per-type **weak/resist tally**. Ability modifiers included.

### 5. Offensive coverage
For every defending type, the best multiplier any of your team's **actual damaging moves** achieves (hover a cell to see which move it is). Members without move data fall back to STAB types, and the note under the table says which basis was used.

### 6. Replacement finder
Select any team member and the app scans the whole Champions roster (Uber/OU/UUBL by default, UU toggleable) for Pokémon that would serve the team better in that slot. Each candidate is scored on the change to the **whole team**, not the individual: super-effective STAB coverage gained, pair synergy with the remaining five, stacked weaknesses removed, unresisted types patched. Every suggestion shows *why* it helps ("unstacks Ice weakness", "adds a resist to Ground", …) and has a one-click **Swap in** button.

### 7. Set editor
Click any filled team slot (or its **Edit set** button) to open a full set editor: ability, item and nature (autocompleted from the calc's dex), level, per-stat EVs and IVs with a live **computed-stat row** (nature boosts/drops color-coded, EV budget validated against the 508 cap), and four move slots whose autocomplete lists **only the moves that Pokémon can legally learn in Champions** (learnsets fetched per-mon from the Smogon dex; Megas share their base form's learnset). Illegal moves are rejected on save with a clear message, Showdown imports warn about them, and any slot carrying a not-learnable move (e.g. from a previously saved team) shows a red **⚠ can't learn** badge that opens the editor. There's also a **usage-ranked move picker** — the mon's most common ladder moves shown as one-click chips with usage percentages (e.g. Gholdengo: Shadow Ball 98%, Make It Rain 97%…). Unknown moves and items are rejected on save. Saved sets show on the slot card, persist with the team, feed the damage calculator, and round-trip through Showdown export.

### 8. Showdown import / export
Paste a team in [Pokémon Showdown](https://pokemonshowdown.com/) export format to load it — items, EVs/IVs, natures, levels, and moves are all kept, shown on each slot, and used by the damage calculator. Export works the same way (one click copies the paste to your clipboard). Nicknames, gender tags, and non-Champions Pokémon in a paste are handled gracefully.

### 9. Damage calculator
Real damage math via the open-source [@smogon/calc](https://github.com/smogon/damage-calc) engine (the same library behind the official Showdown damage calculator), vendored as a single script so the site stays build-free. Pick an attacker from your team and any defender from the dex:

- Uses the attacker's **saved set** (item, EVs, nature, level, moves); members without one fall back to their most common ladder moves
- Defenders get their **most common ladder spread and item**, so percentages reflect what you'd actually meet
- Per-move **damage ranges and KO chances** ("93.8% chance to OHKO")
- **Singles/Doubles** toggle (doubles spread-damage reduction applied) plus weather and terrain conditions
- Champions-exclusive Mega Evolutions are fully supported

### 10. Best targets
The mirror of Top threats: scans the metagame and ranks Pokémon by how hard your team's **actual saved moves** hit them — who is weak to your team. Shows how many members land a super-effective hit, the single hardest hit and which move delivers it ("Garchomp-Mega's Earthquake, 4×"), and whether the target threatens you back ("safe matchup" when it doesn't). Members without saved moves count with their STAB types; a target's defensive ability is applied when unambiguous.

### 11. Speed tiers
A level-50 speed ladder mixing your team with the metagame — who moves before whom. Your members (highlighted) use their **saved spread, nature, and item** (Choice Scarf ×1.5 etc.); meta Pokémon show their most common ladder spread's speed (falling back to max-invested). A **Tailwind toggle** doubles your side's speeds, ties are visually grouped, and the list is trimmed to what matters: everything faster than your slowest member plus a short tail below.

### 12. Top threats
Scans the Champions metagame (Uber/OU/UUBL by default, UU toggleable) and ranks Pokémon by threat score:

```
threat score = 2 × (your members it hits super-effectively with STAB)
             + (your STAB types it resists or is immune to)
```

Only Pokémon that hit at least 2 of your members super-effectively are listed.

## Methodology & limitations

- **Type chart**: standard Gen 6+ 18-type chart, as used by Pokémon Champions.
- **Moveset data**: default sets come from Smogon usage stats for the Champions VGC doubles ladder (`gen9championsvgc2026regmb`, 1.16M battles), with the 4v4 doubles UU ladder as fallback; 41 rarely-played mons have no usage data and start without moves. The threat analysis still uses STAB types (a threat's real moveset isn't knowable in advance).
- **EV scale**: Champions uses a 0–32 stat-unit system; usage-stat spreads are converted to the familiar 0–252 EV scale (×8, capped) with a 528 budget.
- **Abilities**: only effectiveness-modifying abilities are modeled. Abilities like Intimidate, Unaware, or Good as Gold (move immunity, not damage) are out of scope for a type calculator.
- **Threat scoring for multi-ability threats**: a threat's own defensive ability is only applied when it has exactly one ability (no guessing which one it runs).
- **Data snapshot**: roster and tiers were extracted from Smogon's dex in July 2026. Champions receives roster updates; see `data/README.md` for how to refresh.

## Project structure

```
index.html          app shell
css/style.css       dark theme, heatmap colors (diverging blue = resist / red = weak)
js/typechart.js     18-type chart, type colors, ability modifiers, effectiveness()
js/movesets.js      default-set helpers (auto-fill, damaging-move lookup)
js/app.js           team state, autocomplete, analysis rendering, threat scoring
js/showdown.js      Showdown paste parser + exporter
js/seteditor.js     per-Pokémon set editor modal (ability/item/nature/EVs/moves)
js/damagecalc.js    damage calculator card (wraps the vendored @smogon/calc)
js/vendor/          @smogon/calc bundled as a single browser script (MIT)
data/pokemon.js     323-Pokémon roster (names, types, abilities, stats, tiers)
data/movesets.js    doubles usage data: top moves w/ %, item, spread, ability per mon
data/learnsets.js   per-mon legal moves in Champions (Megas alias to base forms)
data/README.md      how the data was extracted and how to refresh it
```

## Refreshing the data

The Smogon dex embeds its full roster as JSON in the page. To re-extract:

```bash
curl -s "https://www.smogon.com/dex/champions/pokemon/" -o /tmp/champions.html
python3 scripts/extract_data.py       # regenerates data/pokemon.js
python3 scripts/extract_movesets.py   # regenerates data/movesets.js from latest usage stats
python3 scripts/extract_learnsets.py  # regenerates data/learnsets.js (per-mon legal moves)
```

## Roadmap

See [FEATURES.md](FEATURES.md) for the list of candidate enhancements to choose from.

---

*Unofficial fan tool. Pokémon and Pokémon Champions are trademarks of Nintendo / Creatures Inc. / GAME FREAK Inc. / The Pokémon Company. Roster data courtesy of Smogon.*
