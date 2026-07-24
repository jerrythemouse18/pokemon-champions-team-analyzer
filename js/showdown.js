// Showdown team-paste import/export.
// parseShowdownTeam(text) -> { entries: [{species, ability, set}], errors: [string] }
// exportShowdownTeam(team) -> string  (team = app's slot array of {name, ability, set})

const SHOWDOWN_STAT_KEYS = { hp: 'hp', atk: 'atk', def: 'def', spa: 'spa', spd: 'spd', spe: 'spe' };
const _sdNorm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const _sdByNorm = new Map(POKEMON_DATA.map(p => [_sdNorm(p.name), p]));

function _sdParseStatLine(str) {
  // "252 Atk / 4 HP / 252 Spe" -> {atk:252, hp:4, spe:252}
  const out = {};
  for (const part of str.split('/')) {
    const m = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SpA|SpD|Spe)$/i);
    if (m) out[SHOWDOWN_STAT_KEYS[m[2].toLowerCase()]] = parseInt(m[1], 10);
  }
  return out;
}

function parseShowdownTeam(text) {
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const entries = [];
  const errors = [];

  for (const block of blocks) {
    if (entries.length === 6) { errors.push('More than 6 Pokémon in paste — extras ignored.'); break; }
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);

    // Header: "Name @ Item", "Nickname (Species) @ Item", optional "(M)"/"(F)" gender tag.
    let head = lines[0];
    let item = null;
    const at = head.split(' @ ');
    if (at.length > 1) { item = at.slice(1).join(' @ ').trim(); head = at[0].trim(); }
    head = head.replace(/\s*\((M|F)\)\s*$/, '');
    let species = head;
    const paren = head.match(/\(([^()]+)\)\s*$/);
    if (paren) species = paren[1].trim();

    const mon = _sdByNorm.get(_sdNorm(species));
    if (!mon) { errors.push(`"${species}" is not in the Champions dex — skipped.`); continue; }

    const set = { item: item || null, level: 50, evs: {}, ivs: {}, nature: null, moves: [], teraType: null, ability: null };
    for (const line of lines.slice(1)) {
      if (line.startsWith('- ')) { if (set.moves.length < 4) set.moves.push(line.slice(2).trim()); }
      else if (/^Ability:/i.test(line)) set.ability = line.slice(line.indexOf(':') + 1).trim();
      else if (/^Level:/i.test(line)) set.level = parseInt(line.slice(line.indexOf(':') + 1), 10) || 50;
      else if (/^Tera Type:/i.test(line)) set.teraType = line.slice(line.indexOf(':') + 1).trim();
      else if (/^EVs:/i.test(line)) set.evs = _sdParseStatLine(line.slice(line.indexOf(':') + 1));
      else if (/^IVs:/i.test(line)) set.ivs = _sdParseStatLine(line.slice(line.indexOf(':') + 1));
      else if (/Nature$/i.test(line)) set.nature = line.replace(/Nature$/i, '').trim();
      // Shiny/Happiness/Ball/etc. lines are irrelevant here — ignore silently.
    }

    // Map ability name to our dex's ability index; keep the raw name for export fidelity.
    let abilityIdx = 0;
    if (set.ability) {
      const i = mon.abilities.findIndex(a => a.toLowerCase() === set.ability.toLowerCase());
      if (i >= 0) { abilityIdx = i; set.ability = mon.abilities[i]; }
    }

    // Legality warning (non-blocking): flag moves outside the Champions learnset.
    const legal = typeof learnsetFor === 'function' && learnsetFor(mon.name);
    if (legal) {
      const canon = new Map(legal.map(mv => [mv.toLowerCase(), mv]));
      set.moves = set.moves.map(mv => canon.get(mv.toLowerCase()) || mv);
      const illegal = set.moves.filter(mv => !canon.has(mv.toLowerCase()));
      if (illegal.length) errors.push(`${mon.name} can't learn ${illegal.join(', ')} in Champions — imported anyway; edit the set to fix.`);
    }
    entries.push({ species: mon.name, ability: abilityIdx, set });
  }
  return { entries, errors };
}

const STAT_LABELS = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };

function _sdStatLine(obj) {
  return ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
    .filter(k => obj[k] != null)
    .map(k => `${obj[k]} ${STAT_LABELS[k]}`)
    .join(' / ');
}

function exportShowdownTeam(team) {
  const byName = new Map(POKEMON_DATA.map(p => [p.name, p]));
  const out = [];
  for (const m of team) {
    if (!m) continue;
    const p = byName.get(m.name);
    const set = m.set || {};
    const lines = [];
    lines.push(p.name + (set.item ? ` @ ${set.item}` : ''));
    lines.push(`Ability: ${set.ability || p.abilities[m.ability || 0] || p.abilities[0]}`);
    lines.push(`Level: ${set.level || 50}`);
    if (set.teraType) lines.push(`Tera Type: ${set.teraType}`);
    const evs = _sdStatLine(set.evs || {});
    if (evs) lines.push(`EVs: ${evs}`);
    if (set.nature) lines.push(`${set.nature} Nature`);
    const ivs = _sdStatLine(set.ivs || {});
    if (ivs) lines.push(`IVs: ${ivs}`);
    for (const mv of set.moves || []) lines.push(`- ${mv}`);
    out.push(lines.join('\n'));
  }
  return out.join('\n\n') + '\n';
}
