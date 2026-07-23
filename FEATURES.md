# Candidate enhancements — pick what you want next

The prototype covers team input + type advantage/disadvantage analysis. These are the features I'd consider next, grouped by theme and rough effort. Tell me which ones to build.

## A. Deeper battle analysis

| # | Feature | What it adds | Effort |
|---|---------|--------------|--------|
| A1 | **Movepool-aware coverage** | Pull each Pokémon's actual learnset from Smogon so offense/threat analysis uses real coverage moves, not just STAB. Biggest single accuracy upgrade. | Large |
| A2 | **Damage calculator** | Full damage formula with base stats, EVs/IVs/natures, and move base power — "does Mega Garchomp's Earthquake OHKO Gholdengo?" | Large |
| A3 | **Speed tiers view** | Sort your team + the meta by Speed stat; show who you outspeed at common benchmarks (max speed, neutral, uninvested). | Small |
| A4 | **Threat matchup detail** | Click a threat to see exactly which of your members it beats/loses to and with what multipliers. | Small |
| A5 | **Mega Evolution comparison** | Side-by-side base vs. Mega form when picking (e.g. Garchomp vs Garchomp-Mega) with stat/typing deltas. | Medium |

## B. Team building assistance

| # | Feature | What it adds | Effort |
|---|---------|--------------|--------|
| B1 | ~~**Auto-suggest 6th member**~~ | ✅ Shipped as the **Replacement finder** — select a member and get ranked, explained replacement suggestions with one-click swap. | Done |
| B2 | **Team score & grade** | A single 0–100 team score (defensive synergy + offensive coverage + speed profile) so you can compare team drafts. | Medium |
| B3 | **Smogon set integration** | Show recommended competitive sets/roles from Smogon's Champions analyses on each picked Pokémon. | Medium |
| B4 | **Multiple saved teams** | Name, save, duplicate, and compare several teams side by side. | Medium |
| B5 | **Import/export Showdown format** | Paste a Pokémon Showdown team export to load it; export your team the same way. | Small |

## C. Usability & polish

| # | Feature | What it adds | Effort |
|---|---------|--------------|--------|
| C1 | **Pokémon sprites** | Official artwork/sprites in slots, autocomplete, and threat list. | Small |
| C2 | **Light mode** | Validated light theme with a toggle. | Small |
| C3 | **Mobile layout pass** | Optimized matrix rendering for phones (Champions is a Switch/mobile game, so likely used on the go). | Medium |
| C4 | **PWA / offline** | Installable, works offline — the data is already bundled. | Small |
| C5 | **Type chart explorer** | A standalone interactive 18×18 type chart page for quick lookups. | Small |

## D. Meta & data

| # | Feature | What it adds | Effort |
|---|---------|--------------|--------|
| D1 | **Usage-stats weighting** | Weight the threat list by actual Champions usage stats (once Smogon publishes them) instead of tier alone. | Medium |
| D2 | **Auto data refresh** | A script + GitHub Action that re-scrapes the Smogon dex weekly and opens a PR when the roster changes. | Medium |
| D3 | **Tier filter for suggestions** | Restrict partner suggestions/threats to the tier you play (OU-legal only, etc.). | Small |

## My recommendation for the next iteration

**A4 + C1 + B5** — threat detail drill-down, sprites, and Showdown import/export. They're all small-to-medium, make the tool feel dramatically more complete, and B5 connects it to the tooling competitive players already use. After that, **A1 (movepool data)** is the big unlock for analysis accuracy.
