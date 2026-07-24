// Default-set helpers on top of MOVESET_DATA / MOVE_META (data/movesets.js).
// When a Pokémon is added to the team, it gets the most common doubles set
// from Champions VGC ladder usage: top-4 moves, top item, ability, and spread.

const toMoveId = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function movesetFor(name) {
  return (typeof MOVESET_DATA !== 'undefined' && MOVESET_DATA[name]) || null;
}

// Resolve a chaos ability id ("goodasgold") to the mon's ability index.
function abilityIndexFromId(p, abilityId) {
  if (!abilityId) return 0;
  const idx = p.abilities.findIndex(a => toMoveId(a) === abilityId);
  return idx >= 0 ? idx : 0;
}

// The most common doubles set, in team[i].set shape. Null when unranked.
function defaultSet(name) {
  const ms = movesetFor(name);
  if (!ms) return null;
  const p = byName.get(name);
  return {
    item: ms.item || null,
    level: 50,
    evs: ms.evs ? { ...ms.evs } : {},
    ivs: {},
    nature: ms.nature || 'Serious',
    moves: ms.moves.slice(0, 4).map(m => m.name),
    ability: p.abilities[abilityIndexFromId(p, ms.ability)] || p.abilities[0],
    teraType: null,
  };
}

// Build a full team member with the default set applied.
function newTeamMember(name) {
  const p = byName.get(name);
  const set = defaultSet(name);
  return {
    name,
    ability: set ? abilityIndexFromId(p, movesetFor(name).ability) : 0,
    ...(set ? { set } : {}),
  };
}

// Legal moves for a Pokémon (Megas/cosmetic forms resolve to their base form).
// Null when learnset data is unavailable.
function learnsetFor(name) {
  if (typeof LEARNSETS === 'undefined') return null;
  return LEARNSETS[(typeof LEARNSET_ALIASES !== 'undefined' && LEARNSET_ALIASES[name]) || name] || null;
}

// Moves in a member's saved set that aren't in its Champions learnset.
// Empty when everything is legal or when there's no learnset/set data.
function illegalMoves(mon) {
  const moves = mon.set && mon.set.moves;
  const legal = moves && moves.length ? learnsetFor(mon.name) : null;
  if (!legal) return [];
  const canon = new Set(legal.map(mv => mv.toLowerCase()));
  return moves.filter(mv => !canon.has(mv.toLowerCase()));
}

// Damaging moves a member actually has (for coverage analysis).
// Falls back to null when the member has no move data.
function memberDamagingMoves(mon) {
  const moves = mon.set && mon.set.moves;
  if (!moves || !moves.length || typeof MOVE_META === 'undefined') return null;
  const out = [];
  for (const name of moves) {
    const meta = MOVE_META[name];
    if (meta && meta.cat !== 'Non-Damaging' && meta.power > 0) {
      out.push({ name, type: meta.type, cat: meta.cat, power: meta.power });
    }
  }
  return out.length ? out : null;
}
