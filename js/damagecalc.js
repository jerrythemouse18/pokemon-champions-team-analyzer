// Damage calculator card — real damage math via the vendored @smogon/calc bundle
// (window.SmogonCalc). Champions runs on the Gen 9 engine; the calc's gen-9 dex
// already includes the Champions-exclusive Mega forms.

const CALC = window.SmogonCalc;
const CALC_GEN = CALC ? CALC.Generations.get(9) : null;

// Names in our dex that need an explicit alias in the calc's species table.
const CALC_ALIASES = { 'Aegislash': 'Aegislash-Shield', 'Meowstic-M': 'Meowstic' };

function calcSpecies(name) {
  const target = CALC_ALIASES[name] || name;
  return CALC_GEN.species.get(CALC.toID(target)) ? target : null;
}

// Build a calc Pokemon from an app slot ({name, ability, set}) or a bare dex entry.
// Falls back to stat/type overrides from POKEMON_DATA if the species is somehow
// absent from the calc dex, so a roster refresh can't break the card.
function toCalcPokemon(mon, dexEntry) {
  const set = mon.set || {};
  const p = dexEntry;
  const opts = {
    level: set.level || 50,
    ability: set.ability || p.abilities[mon.ability || 0] || p.abilities[0],
    item: set.item || undefined,
    nature: set.nature || 'Serious',
    evs: set.evs || {},
    ivs: set.ivs || {},
  };
  const resolved = calcSpecies(mon.name);
  if (resolved) return new CALC.Pokemon(CALC_GEN, resolved, opts);
  opts.overrides = { baseStats: p.stats, types: p.types };
  return new CALC.Pokemon(CALC_GEN, 'Mew', opts);
}

// Last-resort default moves when a member has neither a set nor usage data:
// a standard, widely-learnable STAB move per type.
const STANDARD_STAB = {
  Normal:   { phys: 'Body Slam',       spec: 'Hyper Voice' },
  Fire:     { phys: 'Flare Blitz',     spec: 'Flamethrower' },
  Water:    { phys: 'Waterfall',       spec: 'Surf' },
  Electric: { phys: 'Wild Charge',     spec: 'Thunderbolt' },
  Grass:    { phys: 'Seed Bomb',       spec: 'Energy Ball' },
  Ice:      { phys: 'Icicle Crash',    spec: 'Ice Beam' },
  Fighting: { phys: 'Close Combat',    spec: 'Focus Blast' },
  Poison:   { phys: 'Poison Jab',      spec: 'Sludge Bomb' },
  Ground:   { phys: 'Earthquake',      spec: 'Earth Power' },
  Flying:   { phys: 'Brave Bird',      spec: 'Air Slash' },
  Psychic:  { phys: 'Zen Headbutt',    spec: 'Psychic' },
  Bug:      { phys: 'X-Scissor',       spec: 'Bug Buzz' },
  Rock:     { phys: 'Rock Slide',      spec: 'Power Gem' },
  Ghost:    { phys: 'Poltergeist',     spec: 'Shadow Ball' },
  Dragon:   { phys: 'Dragon Claw',     spec: 'Draco Meteor' },
  Dark:     { phys: 'Crunch',          spec: 'Dark Pulse' },
  Steel:    { phys: 'Iron Head',       spec: 'Flash Cannon' },
  Fairy:    { phys: 'Play Rough',      spec: 'Moonblast' },
};

function defaultMoves(dexEntry) {
  // Prefer real usage data: this mon's most common doubles moves.
  const ms = typeof movesetFor === 'function' && movesetFor(dexEntry.name);
  if (ms) return ms.moves.slice(0, 4).map(m => m.name);
  const physical = dexEntry.stats.atk >= dexEntry.stats.spa;
  return dexEntry.types
    .map(t => STANDARD_STAB[t] && STANDARD_STAB[t][physical ? 'phys' : 'spec'])
    .filter(Boolean);
}

function renderDamageCalc(mons) {
  const section = document.querySelector('#damage-section');
  if (!CALC) { section.hidden = true; return; }
  section.hidden = mons.length === 0;
  if (!mons.length) return;

  const atkSel = document.querySelector('#dmg-attacker');
  const prevAtk = atkSel.value;
  atkSel.innerHTML = mons.map((m, i) => `<option value="${i}">${m.name}</option>`).join('');
  if (prevAtk !== '' && +prevAtk < mons.length) atkSel.value = prevAtk;

  renderDamageResults(mons);
}

let dmgDefender = null; // dex entry chosen in the defender autocomplete

function renderDamageResults(mons) {
  const out = document.querySelector('#dmg-results');
  const mon = mons[+document.querySelector('#dmg-attacker').value || 0];
  if (!mon || !dmgDefender) { out.innerHTML = dmgDefender ? '' : '<p class="hint">Choose a defender to see damage ranges.</p>'; return; }

  const byName = new Map(POKEMON_DATA.map(p => [p.name, p]));
  const atkDex = byName.get(mon.name);
  const defDex = dmgDefender;

  const attacker = toCalcPokemon(mon, atkDex);
  // Defender gets its most common ladder spread/item when known, so the
  // percentages reflect what you'd actually meet.
  const defSet = typeof defaultSet === 'function' ? defaultSet(defDex.name) : null;
  const defender = toCalcPokemon({ name: defDex.name, ability: 0, set: defSet || undefined }, defDex);

  const field = new CALC.Field({
    gameType: document.querySelector('#dmg-doubles').checked ? 'Doubles' : 'Singles',
    weather: document.querySelector('#dmg-weather').value || undefined,
    terrain: document.querySelector('#dmg-terrain').value || undefined,
  });

  const moves = (mon.set && mon.set.moves && mon.set.moves.length) ? mon.set.moves : defaultMoves(atkDex);
  const usingDefaults = !(mon.set && mon.set.moves && mon.set.moves.length);

  const rows = [];
  for (const mvName of moves) {
    let result;
    try {
      const mv = new CALC.Move(CALC_GEN, mvName);
      if (mv.category === 'Status') { rows.push({ name: mvName, status: true }); continue; }
      result = CALC.calculate(CALC_GEN, attacker, defender, mv, field);
    } catch (e) {
      rows.push({ name: mvName, error: true });
      continue;
    }
    const range = result.range();
    const maxHP = defender.maxHP();
    const lo = (range[0] / maxHP * 100), hi = (range[1] / maxHP * 100);
    let ko = '';
    try { ko = result.kochance().text; } catch (e) { /* 0-damage results have no KO chance */ }
    rows.push({ name: mvName, lo, hi, ko, desc: result.desc() });
  }

  rows.sort((a, b) => (b.hi || 0) - (a.hi || 0));

  out.innerHTML =
    (usingDefaults ? '<p class="hint">No saved moveset for this member — showing its most common ladder moves (or generic STAB when unranked). Click the team slot to set exact moves.</p>' : '') +
    rows.map(r => {
      if (r.status) return `<div class="threat"><span class="threat-name">${r.name}</span><span class="threat-detail">status move — no damage</span></div>`;
      if (r.error) return `<div class="threat"><span class="threat-name">${r.name}</span><span class="threat-detail">move not recognized by the calculator</span></div>`;
      const cls = r.hi >= 100 ? 'c-weak2' : r.hi >= 50 ? 'c-weak' : 'c-neutral';
      return `<div class="threat" title="${r.desc}">
        <span class="threat-name">${r.name}</span>
        <span class="dmg-range ${cls}">${r.lo.toFixed(1)}&ndash;${r.hi.toFixed(1)}%</span>
        <span class="threat-detail">${r.ko}</span>
      </div>`;
    }).join('');
}

function attachDefenderPicker() {
  const input = document.querySelector('#dmg-defender');
  const ac = document.querySelector('#dmg-defender-ac');
  let matches = [];

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    ac.innerHTML = '';
    if (!q) { ac.hidden = true; dmgDefender = null; renderDamageResults(team.filter(Boolean)); return; }
    matches = POKEMON_DATA.filter(p => p.name.toLowerCase().includes(q)).slice(0, 12);
    if (!matches.length) { ac.hidden = true; return; }
    matches.forEach(p => {
      const item = document.createElement('div');
      item.className = 'ac-item';
      item.innerHTML = `<span>${p.name} ${p.types.map(typeBadge).join(' ')}</span><span class="ac-tier">${p.tier}</span>`;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        dmgDefender = p;
        input.value = p.name;
        ac.hidden = true;
        renderDamageResults(team.filter(Boolean));
      });
      ac.appendChild(item);
    });
    ac.hidden = false;
  });
  input.addEventListener('blur', () => setTimeout(() => { ac.hidden = true; }, 150));
}
