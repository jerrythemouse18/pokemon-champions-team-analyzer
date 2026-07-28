// Speed tiers card — a level-50 speed ladder mixing your team (real saved
// spreads + item modifiers) with the meta's common / max / uninvested speeds.

const SPEED_ITEM_MODS = { 'Choice Scarf': 1.5, 'Iron Ball': 0.5, 'Power Anklet': 0.5, 'Macho Brace': 0.5 };

// Ability that doubles Speed under each weather.
const WEATHER_SPEED_ABILITY = {
  Rain: 'Swift Swim',
  Sun: 'Chlorophyll',
  Sand: 'Sand Rush',
  Snow: 'Slush Rush',
};

// Does this ability double speed in the selected weather? For meta mons we
// use their most common ladder ability, falling back to "any ability they
// could run" so a Swift Swim option is never hidden.
function weatherBoostsMon(weather, ability, allAbilities) {
  if (!weather) return false;
  const boostAbility = WEATHER_SPEED_ABILITY[weather];
  if (ability) return ability === boostAbility;
  return (allAbilities || []).includes(boostAbility);
}

// Level-50 stat from base speed, EVs (0-252), IVs, and nature multiplier.
function speedStat(base, ev, iv, natureMult) {
  return Math.floor((Math.floor((2 * base + iv + Math.floor(ev / 4)) * 50 / 100) + 5) * natureMult);
}

function natureSpeedMult(natureName) {
  if (!window.SmogonCalc || !natureName) return 1;
  const nat = window.SmogonCalc.Generations.get(9).natures.get(window.SmogonCalc.toID(natureName));
  if (!nat || nat.plus === nat.minus) return 1;
  return nat.plus === 'spe' ? 1.1 : nat.minus === 'spe' ? 0.9 : 1;
}

// A team member's actual speed: saved spread + nature + item, optional
// tailwind and weather-ability boost (uses the member's selected ability).
function memberSpeed(mon, tailwind, weather) {
  const p = byName.get(mon.name);
  const set = mon.set || {};
  const ev = (set.evs && set.evs.spe) || 0;
  const iv = set.ivs && set.ivs.spe != null ? set.ivs.spe : 31;
  let spe = speedStat(p.stats.spe, ev, iv, natureSpeedMult(set.nature));
  const itemMod = set.item && SPEED_ITEM_MODS[set.item];
  if (itemMod) spe = Math.floor(spe * itemMod);
  if (weather && weatherBoostsMon(weather, monAbility(mon))) spe *= 2;
  if (tailwind) spe *= 2;
  return spe;
}

// Meta benchmarks for a dex entry: common ladder spread (when known), max,
// uninvested. Weather boost applies when the mon's ladder-common ability is
// the booster (or any of its abilities, when unranked).
function metaSpeeds(p, weather) {
  const ms = movesetFor(p.name);
  const ladderAbility = ms && ms.ability
    ? p.abilities[abilityIndexFromId(p, ms.ability)] || null
    : null;
  const boosted = weatherBoostsMon(weather, ladderAbility, p.abilities);
  const boost = spe => boosted ? spe * 2 : spe;
  const tag = boosted ? ` · ${WEATHER_SPEED_ABILITY[weather]}` : '';

  const out = [];
  if (ms && ms.evs) {
    const nat = ms.nature || 'Serious';
    let spe = speedStat(p.stats.spe, ms.evs.spe || 0, 31, natureSpeedMult(nat));
    if (ms.item && SPEED_ITEM_MODS[ms.item]) spe = Math.floor(spe * SPEED_ITEM_MODS[ms.item]);
    out.push({ kind: 'common', spe: boost(spe), note: `${nat}${ms.evs.spe ? ` ${ms.evs.spe} Spe` : ''}${ms.item && SPEED_ITEM_MODS[ms.item] ? ` @ ${ms.item}` : ''}${tag}` });
  }
  out.push({ kind: 'max', spe: boost(speedStat(p.stats.spe, 252, 31, 1.1)), note: '252 Spe, +nature' + tag });
  out.push({ kind: 'base', spe: boost(speedStat(p.stats.spe, 0, 31, 1)), note: 'uninvested' + tag });
  return out;
}

function renderSpeedTiers(mons) {
  const includeUU = $('#speed-uu').checked;
  const tailwind = $('#speed-tailwind').checked;
  const weather = $('#speed-weather').value;
  const query = $('#speed-search').value.trim().toLowerCase();
  const tiers = includeUU ? ['Uber', 'OU', 'UUBL', 'UU'] : ['Uber', 'OU', 'UUBL'];
  const picked = new Set(mons.map(m => m.name));

  const rows = [];
  for (const m of mons) {
    const set = m.set || {};
    const bits = [];
    if (set.nature && natureSpeedMult(set.nature) !== 1) bits.push(natureSpeedMult(set.nature) > 1 ? '+Spe nature' : '−Spe nature');
    if (set.evs && set.evs.spe) bits.push(`${set.evs.spe} Spe EVs`);
    if (set.item && SPEED_ITEM_MODS[set.item]) bits.push(`@ ${set.item}`);
    if (weather && weatherBoostsMon(weather, monAbility(m))) bits.push(WEATHER_SPEED_ABILITY[weather]);
    if (tailwind) bits.push('Tailwind');
    rows.push({ name: m.name, spe: memberSpeed(m, tailwind, weather), mine: true, note: bits.join(', ') || 'no speed investment' });
  }

  for (const p of POKEMON_DATA) {
    if (picked.has(p.name)) continue;
    // A search looks across ALL tiers (finding "Dragapult" shouldn't require
    // the right tier toggle); otherwise the tier filter applies.
    if (query ? !p.name.toLowerCase().includes(query) : !tiers.includes(p.tier)) continue;
    const speeds = metaSpeeds(p, weather);
    if (query) {
      // Searched mons show every benchmark: common, max, and uninvested.
      for (const s of speeds) {
        rows.push({ name: p.name, spe: s.spe, mine: false, note: s.note, tier: p.tier });
      }
    } else {
      // Only the most relevant benchmark per meta mon keeps the ladder readable.
      const chosen = speeds.find(s => s.kind === 'common') || speeds.find(s => s.kind === 'max');
      rows.push({ name: p.name, spe: chosen.spe, mine: false, note: chosen.note, tier: p.tier });
    }
  }

  rows.sort((a, b) => b.spe - a.spe || (a.mine === b.mine ? 0 : a.mine ? -1 : 1));

  // Keep the meta list focused: everything faster than your slowest member,
  // plus a short tail below so you can see what you outspeed. A search shows
  // all matches regardless.
  const slowestMine = rows.some(r => r.mine) ? Math.min(...rows.filter(r => r.mine).map(r => r.spe)) : 0;
  let tail = 0;
  const shown = rows.filter(r => {
    if (r.mine || query || r.spe >= slowestMine) return true;
    return ++tail <= 8;
  });

  const table = $('#speed-table');
  if (query && !shown.some(r => !r.mine)) {
    table.innerHTML = `<tbody><tr><td class="speed-note" style="padding:10px 4px">No Pokémon matching “${query.replace(/</g, '&lt;')}”.</td></tr></tbody>`;
    return;
  }
  let html = '<thead><tr><th>Spe</th><th>Pokémon</th><th>Spread</th></tr></thead><tbody>';
  let lastSpe = null;
  for (const r of shown) {
    const tie = r.spe === lastSpe ? ' class="speed-tie"' : '';
    lastSpe = r.spe;
    html += `<tr${r.mine ? ' class="speed-mine"' : tie}>
      <td class="c-total">${r.spe}</td>
      <th>${r.name}${r.mine ? '' : ` <span class="mon-tier">${r.tier}</span>`}</th>
      <td class="speed-note">${r.note}</td>
    </tr>`;
  }
  html += '</tbody>';
  table.innerHTML = html;
}
