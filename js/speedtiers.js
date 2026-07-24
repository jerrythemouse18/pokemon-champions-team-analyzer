// Speed tiers card — a level-50 speed ladder mixing your team (real saved
// spreads + item modifiers) with the meta's common / max / uninvested speeds.

const SPEED_ITEM_MODS = { 'Choice Scarf': 1.5, 'Iron Ball': 0.5, 'Power Anklet': 0.5, 'Macho Brace': 0.5 };

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

// A team member's actual speed: saved spread + nature + item, optional tailwind.
function memberSpeed(mon, tailwind) {
  const p = byName.get(mon.name);
  const set = mon.set || {};
  const ev = (set.evs && set.evs.spe) || 0;
  const iv = set.ivs && set.ivs.spe != null ? set.ivs.spe : 31;
  let spe = speedStat(p.stats.spe, ev, iv, natureSpeedMult(set.nature));
  const itemMod = set.item && SPEED_ITEM_MODS[set.item];
  if (itemMod) spe = Math.floor(spe * itemMod);
  if (tailwind) spe *= 2;
  return spe;
}

// Meta benchmarks for a dex entry: common ladder spread (when known), max, uninvested.
function metaSpeeds(p) {
  const ms = movesetFor(p.name);
  const out = [];
  if (ms && ms.evs) {
    const nat = ms.nature || 'Serious';
    let spe = speedStat(p.stats.spe, ms.evs.spe || 0, 31, natureSpeedMult(nat));
    if (ms.item && SPEED_ITEM_MODS[ms.item]) spe = Math.floor(spe * SPEED_ITEM_MODS[ms.item]);
    out.push({ kind: 'common', spe, note: `${nat}${ms.evs.spe ? ` ${ms.evs.spe} Spe` : ''}${ms.item && SPEED_ITEM_MODS[ms.item] ? ` @ ${ms.item}` : ''}` });
  }
  out.push({ kind: 'max', spe: speedStat(p.stats.spe, 252, 31, 1.1), note: '252 Spe, +nature' });
  out.push({ kind: 'base', spe: speedStat(p.stats.spe, 0, 31, 1), note: 'uninvested' });
  return out;
}

function renderSpeedTiers(mons) {
  const includeUU = $('#speed-uu').checked;
  const tailwind = $('#speed-tailwind').checked;
  const tiers = includeUU ? ['Uber', 'OU', 'UUBL', 'UU'] : ['Uber', 'OU', 'UUBL'];
  const picked = new Set(mons.map(m => m.name));

  const rows = [];
  for (const m of mons) {
    const set = m.set || {};
    const bits = [];
    if (set.nature && natureSpeedMult(set.nature) !== 1) bits.push(natureSpeedMult(set.nature) > 1 ? '+Spe nature' : '−Spe nature');
    if (set.evs && set.evs.spe) bits.push(`${set.evs.spe} Spe EVs`);
    if (set.item && SPEED_ITEM_MODS[set.item]) bits.push(`@ ${set.item}`);
    if (tailwind) bits.push('Tailwind');
    rows.push({ name: m.name, spe: memberSpeed(m, tailwind), mine: true, note: bits.join(', ') || 'no speed investment' });
  }

  for (const p of POKEMON_DATA) {
    if (!tiers.includes(p.tier) || picked.has(p.name)) continue;
    // Only the most relevant benchmark per meta mon keeps the ladder readable:
    // common spread when known, otherwise max.
    const speeds = metaSpeeds(p);
    const chosen = speeds.find(s => s.kind === 'common') || speeds.find(s => s.kind === 'max');
    rows.push({ name: p.name, spe: chosen.spe, mine: false, note: chosen.note, tier: p.tier });
  }

  rows.sort((a, b) => b.spe - a.spe || (a.mine === b.mine ? 0 : a.mine ? -1 : 1));

  // Keep the meta list focused: everything faster than your slowest member,
  // plus a short tail below so you can see what you outspeed.
  const slowestMine = Math.min(...rows.filter(r => r.mine).map(r => r.spe));
  let tail = 0;
  const shown = rows.filter(r => {
    if (r.mine || r.spe >= slowestMine) return true;
    return ++tail <= 8;
  });

  const table = $('#speed-table');
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
