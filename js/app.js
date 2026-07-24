// Champions Team Analyzer — main app logic.
// State: 6 slots, each null or { name, ability } (ability index into the mon's ability list).

const SLOTS = 6;
const byName = new Map(POKEMON_DATA.map(p => [p.name, p]));
let team = loadTeam();

const $ = sel => document.querySelector(sel);
const teamGrid = $('#team-grid');

// ---------- persistence ----------
function loadTeam() {
  let stored = null;
  try {
    const raw = localStorage.getItem('champions-team');
    if (raw) {
      const t = JSON.parse(raw);
      if (Array.isArray(t) && t.length === SLOTS) {
        stored = t.map(m => (m && byName.has(m.name)) ? m : null);
      }
    }
  } catch (e) { /* ignore corrupt state */ }

  // URL hash wins over localStorage so shared links work — but the hash only
  // carries name:ability, so if it matches the stored team, prefer stored
  // (which keeps imported movesets/EVs).
  const fromHash = decodeHash();
  if (fromHash) {
    const sameMons = stored && fromHash.every((m, i) =>
      (m === null) === (stored[i] === null) && (!m || m.name === stored[i].name));
    return sameMons ? stored : fromHash;
  }
  return stored || Array(SLOTS).fill(null);
}

function saveTeam() {
  localStorage.setItem('champions-team', JSON.stringify(team));
  const packed = team.map(m => m ? encodeURIComponent(m.name) + (m.ability ? ':' + m.ability : '') : '').join(',');
  history.replaceState(null, '', packed.replace(/,+$/, '') ? '#team=' + packed : location.pathname);
}

function decodeHash() {
  const m = location.hash.match(/#team=(.*)/);
  if (!m) return null;
  const parts = m[1].split(',');
  const t = Array(SLOTS).fill(null);
  parts.slice(0, SLOTS).forEach((p, i) => {
    if (!p) return;
    const [name, ab] = p.split(':');
    const decoded = decodeURIComponent(name);
    if (byName.has(decoded)) t[i] = { name: decoded, ability: parseInt(ab, 10) || 0 };
  });
  return t.some(Boolean) ? t : null;
}

// ---------- team slots UI ----------
function renderTeam() {
  teamGrid.innerHTML = '';
  team.forEach((mon, i) => teamGrid.appendChild(mon ? filledSlot(mon, i) : emptySlot(i)));
  renderAnalysis();
  saveTeam();
}

function emptySlot(i) {
  const div = document.createElement('div');
  div.className = 'slot';
  div.innerHTML = `<div class="slot-empty-label">Slot ${i + 1}</div>`;
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search Pokémon…';
  input.setAttribute('aria-label', `Add Pokémon to slot ${i + 1}`);
  div.appendChild(input);
  const ac = document.createElement('div');
  ac.className = 'autocomplete';
  ac.hidden = true;
  div.appendChild(ac);
  attachAutocomplete(input, ac, i);
  return div;
}

function attachAutocomplete(input, ac, slotIdx) {
  let matches = [];
  let active = -1;

  function refresh() {
    const q = input.value.trim().toLowerCase();
    ac.innerHTML = '';
    active = -1;
    if (!q) { ac.hidden = true; return; }
    const picked = new Set(team.filter(Boolean).map(m => m.name));
    matches = POKEMON_DATA
      .filter(p => p.name.toLowerCase().includes(q) && !picked.has(p.name))
      .slice(0, 12);
    if (!matches.length) { ac.hidden = true; return; }
    matches.forEach((p, idx) => {
      const item = document.createElement('div');
      item.className = 'ac-item';
      item.innerHTML = `<span>${p.name} ${p.types.map(typeBadge).join(' ')}</span><span class="ac-tier">${p.tier}</span>`;
      item.addEventListener('mousedown', e => { e.preventDefault(); pick(idx); });
      ac.appendChild(item);
    });
    ac.hidden = false;
  }

  function pick(idx) {
    const p = matches[idx];
    if (!p) return;
    team[slotIdx] = { name: p.name, ability: 0 };
    renderTeam();
  }

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', e => {
    const items = ac.querySelectorAll('.ac-item');
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); }
    else if (e.key === 'Enter') { pick(active >= 0 ? active : 0); return; }
    else if (e.key === 'Escape') { ac.hidden = true; return; }
    else return;
    e.preventDefault();
    items.forEach((it, i2) => it.classList.toggle('active', i2 === active));
    if (items[active]) items[active].scrollIntoView({ block: 'nearest' });
  });
  input.addEventListener('blur', () => setTimeout(() => { ac.hidden = true; }, 150));
}

function filledSlot(mon, i) {
  const p = byName.get(mon.name);
  const div = document.createElement('div');
  div.className = 'slot';

  const rm = document.createElement('button');
  rm.className = 'remove';
  rm.title = 'Remove';
  rm.setAttribute('aria-label', `Remove ${p.name}`);
  rm.textContent = '×';
  rm.addEventListener('click', () => { team[i] = null; renderTeam(); });
  div.appendChild(rm);

  const name = document.createElement('div');
  name.className = 'mon-name';
  name.innerHTML = `${p.name} <span class="mon-tier">${p.tier}</span>`;
  div.appendChild(name);

  const types = document.createElement('div');
  types.className = 'mon-row';
  types.innerHTML = p.types.map(typeBadge).join(' ');
  div.appendChild(types);

  if (p.abilities.length > 1) {
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', `Ability for ${p.name}`);
    p.abilities.forEach((a, ai) => {
      const opt = document.createElement('option');
      opt.value = ai;
      opt.textContent = a + (ABILITY_MODIFIERS[a] ? ' ★' : '');
      if (ai === (mon.ability || 0)) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => { team[i].ability = parseInt(sel.value, 10); renderTeam(); });
    div.appendChild(sel);
  } else {
    const ab = document.createElement('div');
    ab.className = 'mon-stats';
    ab.textContent = 'Ability: ' + p.abilities[0] + (ABILITY_MODIFIERS[p.abilities[0]] ? ' ★' : '');
    div.appendChild(ab);
  }

  const s = p.stats;
  const bst = s.hp + s.atk + s.def + s.spa + s.spd + s.spe;
  const stats = document.createElement('div');
  stats.className = 'mon-stats';
  stats.textContent = `HP ${s.hp} / Atk ${s.atk} / Def ${s.def} / SpA ${s.spa} / SpD ${s.spd} / Spe ${s.spe} · BST ${bst}`;
  div.appendChild(stats);

  if (mon.set) {
    const set = document.createElement('div');
    set.className = 'mon-set';
    const bits = [];
    if (mon.set.item) bits.push(`@ ${mon.set.item}`);
    if (mon.set.nature) bits.push(mon.set.nature);
    if (mon.set.moves && mon.set.moves.length) bits.push(mon.set.moves.join(' / '));
    set.textContent = bits.join(' · ');
    div.appendChild(set);
  }

  return div;
}

function typeBadge(t) {
  return `<span class="type-badge" style="background:${TYPE_COLORS[t]}">${t}</span>`;
}

function monAbility(mon) {
  // Hypothetical candidates with several possible abilities get none applied
  // (same no-guessing convention as the threat analysis).
  if (mon._certainAbility === false) return null;
  const p = byName.get(mon.name);
  return p.abilities[mon.ability || 0] || p.abilities[0];
}

// ---------- analysis ----------
function cellClass(mult) {
  if (mult === 0) return 'c-immune';
  if (mult <= 0.25) return 'c-res2';
  if (mult < 1) return 'c-res';
  if (mult === 1) return 'c-neutral';
  if (mult <= 2) return 'c-weak';
  return 'c-weak2';
}

function multLabel(mult) {
  if (mult === 0) return '0';
  if (mult === 0.25) return '¼';
  if (mult === 0.5) return '½';
  if (mult === 1.25) return '1.25';
  return String(mult);
}

function renderAnalysis() {
  const mons = team.filter(Boolean);
  const show = mons.length > 0;
  ['#summary-section', '#defense-section', '#offense-section', '#threats-section', '#damage-section']
    .forEach(sel => { $(sel).hidden = !show; });
  $('#compat-section').hidden = mons.length < 2;
  $('#replace-section').hidden = mons.length < 2;
  if (!show) return;

  renderDefense(mons);
  renderOffense(mons);
  renderSummary(mons);
  renderArchetype(mons);
  renderThreats(mons);
  renderDamageCalc(mons);
  if (mons.length >= 2) { renderCompat(mons); renderReplacement(mons); }
}

function defenseMult(attackType, mon) {
  const p = byName.get(mon.name);
  return effectiveness(attackType, p.types, monAbility(mon));
}

function renderDefense(mons) {
  const table = $('#defense-table');
  let html = '<thead><tr><th>Attack ↓</th>';
  html += mons.map(m => `<th class="colhead" title="${m.name}">${m.name}</th>`).join('');
  html += '<th class="colhead">Weak / Resist</th></tr></thead><tbody>';

  for (const atk of TYPES) {
    let weak = 0, resist = 0;
    let row = `<tr><th>${atk}</th>`;
    for (const m of mons) {
      const mult = defenseMult(atk, m);
      if (mult > 1) weak++;
      if (mult < 1) resist++;
      row += `<td class="${cellClass(mult)}" title="${atk} vs ${m.name}: ${mult}×">${multLabel(mult)}</td>`;
    }
    row += `<td class="c-total">${weak} / ${resist}</td></tr>`;
    html += row;
  }
  html += '</tbody>';
  table.innerHTML = html;
}

function stabTypes(mons) {
  const set = new Set();
  mons.forEach(m => byName.get(m.name).types.forEach(t => set.add(t)));
  return [...set];
}

function renderOffense(mons) {
  const stabs = stabTypes(mons);
  const table = $('#offense-table');

  let html = '<thead><tr><th>Defender →</th>';
  html += TYPES.map(t => `<th class="colhead">${t.slice(0, 3)}</th>`).join('');
  html += '</tr></thead><tbody><tr><th>Best STAB</th>';

  const notCovered = [];
  for (const def of TYPES) {
    let best = 0;
    for (const atk of stabs) best = Math.max(best, effectiveness(atk, [def], null));
    if (best <= 1) notCovered.push({ type: def, best });
    html += `<td class="${best >= 2 ? 'c-res2' : best === 1 ? 'c-neutral' : 'c-weak2'}" title="Best STAB vs ${def}: ${best}×">${multLabel(best)}</td>`;
  }
  html += '</tr></tbody>';
  table.innerHTML = html;

  const notes = $('#offense-notes');
  if (notCovered.length) {
    notes.innerHTML = 'No super-effective STAB against: ' +
      notCovered.map(n => typeBadge(n.type)).join(' ') +
      '. Consider coverage moves or a teammate of a complementary type.';
  } else {
    notes.innerHTML = 'Your STAB attacks hit every type super-effectively — excellent offensive coverage.';
  }
}

function renderSummary(mons) {
  const chips = $('#summary-chips');
  const sug = $('#suggestions');
  chips.innerHTML = '';
  sug.innerHTML = '';

  const sharedWeak = [];   // types hitting 3+ members super-effectively
  const unresisted = [];   // types no member resists
  for (const atk of TYPES) {
    let weak = 0, resist = 0;
    for (const m of mons) {
      const mult = defenseMult(atk, m);
      if (mult > 1) weak++;
      if (mult < 1) resist++;
    }
    if (weak >= 3) sharedWeak.push({ type: atk, count: weak });
    if (resist === 0 && weak > 0) unresisted.push(atk);
  }

  const addChip = (html, cls) => {
    const c = document.createElement('span');
    c.className = 'chip' + (cls ? ' ' + cls : '');
    c.innerHTML = html;
    chips.appendChild(c);
  };

  addChip(`<b>${mons.length}/6</b> Pokémon`);
  sharedWeak.sort((a, b) => b.count - a.count)
    .forEach(w => addChip(`${typeBadge(w.type)} hits <b>${w.count}</b> members super-effectively`, 'bad'));
  if (!sharedWeak.length && mons.length >= 3) addChip('No attacking type threatens 3+ members', 'good');

  const items = [];
  if (unresisted.length) {
    items.push(`Nobody on the team resists: ${unresisted.map(typeBadge).join(' ')} — an attacker of these types always hits you at least neutrally.`);
  }
  for (const w of sharedWeak) {
    const resisters = suggestResisters(w.type, mons);
    if (resisters.length) {
      items.push(`Stacked ${typeBadge(w.type)} weakness — strong ${w.type}-resistant partners in the meta: ${resisters.map(r => `<b>${r.name}</b> (${r.tier})`).join(', ')}.`);
    }
  }
  if (mons.length < 6) items.push(`Add ${6 - mons.length} more Pokémon to complete the analysis.`);
  sug.innerHTML = items.length ? '<ul>' + items.map(i => `<li>${i}</li>`).join('') + '</ul>' : '';
}

// ---------- team archetype ----------
// Reads abilities + stats only (no moveset data), so detection leans on the
// signals the roster exposes: weather setters/abusers, pace, bulk, utility abilities.
const WEATHER = {
  Rain: {
    setters: ['Drizzle'],
    abusers: ['Swift Swim', 'Rain Dish', 'Hydration'],
    stabBonus: ['Water'],
    label: 'Rain'
  },
  Sun: {
    setters: ['Drought', 'Orichalcum Pulse'],
    abusers: ['Chlorophyll', 'Solar Power', 'Protosynthesis'],
    stabBonus: ['Fire'],
    label: 'Sun'
  },
  Sand: {
    setters: ['Sand Stream'],
    abusers: ['Sand Rush', 'Sand Force'],
    stabBonus: [],
    label: 'Sand'
  },
  Snow: {
    setters: ['Snow Warning'],
    abusers: ['Slush Rush', 'Ice Body'],
    stabBonus: [],
    label: 'Snow'
  }
};

const STALL_ABILITIES = ['Regenerator', 'Unaware', 'Purifying Salt', 'Good as Gold', 'Hospitality'];
const OFFENSE_ABILITIES = ['Speed Boost', 'Protosynthesis', 'Quark Drive', 'Sharpness', 'Adaptability', 'Huge Power', 'Pure Power'];

function detectArchetype(mons) {
  // `abilities` is every ability the mon can run — archetype detection asks
  // "could this team play this style", so the chosen dropdown slot doesn't gate it.
  const entries = mons.map(m => {
    const p = byName.get(m.name);
    return { name: m.name, abilities: p.abilities, stats: p.stats, types: p.types };
  });
  const n = entries.length;
  const hasAbility = (e, list) => e.abilities.find(a => list.includes(a));

  const candidates = []; // { label, score, evidence }

  // --- weather ---
  for (const w of Object.values(WEATHER)) {
    const setters = entries.filter(e => hasAbility(e, w.setters));
    if (!setters.length) continue;
    const abusers = entries.filter(e => !setters.includes(e) && hasAbility(e, w.abusers));
    const stab = w.stabBonus.length
      ? entries.filter(e => !setters.includes(e) && e.types.some(t => w.stabBonus.includes(t)))
      : [];
    // A setter alone is a tendency, not an archetype: need abusers or 2+ STAB beneficiaries.
    const score = setters.length * 2 + abusers.length * 2 + Math.min(stab.length, 3);
    const evidence = [];
    evidence.push(`<b>${setters.map(e => e.name).join(', ')}</b> set${setters.length > 1 ? '' : 's'} it automatically`);
    if (abusers.length) evidence.push(`<b>${abusers.map(e => e.name).join(', ')}</b> abuse${abusers.length > 1 ? '' : 's'} it (${[...new Set(abusers.map(e => hasAbility(e, w.abusers)))].join(', ')})`);
    if (stab.length) evidence.push(`${stab.length} member${stab.length > 1 ? 's' : ''} with boosted STAB (${stab.map(e => e.name).join(', ')})`);
    candidates.push({ label: `${w.label} team`, score, threshold: 5, evidence: evidence.join('; ') });
  }

  // --- trick room ---
  const trAttackers = entries.filter(e => e.stats.spe <= 50 && Math.max(e.stats.atk, e.stats.spa) >= 100);
  if (trAttackers.length) {
    candidates.push({
      label: 'Trick Room',
      score: trAttackers.length * 2.5,
      threshold: 5,
      evidence: `${trAttackers.length} slow, hard-hitting member${trAttackers.length > 1 ? 's' : ''} (${trAttackers.map(e => `<b>${e.name}</b> Spe ${e.stats.spe}`).join(', ')}) — strongest under Trick Room`
    });
  }

  // --- hyper offense ---
  const avgSpe = entries.reduce((s, e) => s + e.stats.spe, 0) / n;
  const fastHitters = entries.filter(e => e.stats.spe >= 100 && Math.max(e.stats.atk, e.stats.spa) >= 110);
  const offAbils = entries.filter(e => hasAbility(e, OFFENSE_ABILITIES));
  if (fastHitters.length || offAbils.length) {
    const score = fastHitters.length * 1.5 + offAbils.length * 1.5 + (avgSpe >= 95 ? 2 : 0);
    const ev = [];
    if (fastHitters.length) ev.push(`${fastHitters.length} fast heavy hitters (${fastHitters.map(e => `<b>${e.name}</b>`).join(', ')})`);
    if (offAbils.length) ev.push(`snowball abilities: ${offAbils.map(e => `<b>${e.name}</b> (${hasAbility(e, OFFENSE_ABILITIES)})`).join(', ')}`);
    if (avgSpe >= 95) ev.push(`team average Speed ${Math.round(avgSpe)}`);
    candidates.push({ label: 'Hyper Offense', score, threshold: 6, evidence: ev.join('; ') });
  }

  // --- stall / fat balance ---
  const bulky = entries.filter(e => (e.stats.hp + e.stats.def + e.stats.spd) >= 280);
  const stallAbils = entries.filter(e => hasAbility(e, STALL_ABILITIES));
  if (bulky.length >= 2 || stallAbils.length) {
    const score = bulky.length * 1.2 + stallAbils.length * 2 + (avgSpe <= 70 ? 1.5 : 0);
    const ev = [];
    if (bulky.length) ev.push(`${bulky.length} high-bulk member${bulky.length > 1 ? 's' : ''} (${bulky.map(e => `<b>${e.name}</b>`).join(', ')})`);
    if (stallAbils.length) ev.push(`longevity/anti-setup abilities: ${stallAbils.map(e => `<b>${e.name}</b> (${hasAbility(e, STALL_ABILITIES)})`).join(', ')}`);
    candidates.push({ label: 'Stall / Fat Balance', score, threshold: 7, evidence: ev.join('; ') });
  }

  candidates.sort((a, b) => b.score - a.score);
  const primary = candidates.find(c => c.score >= c.threshold);
  // Secondary tendencies: confident-ish signals that aren't the primary.
  const secondary = candidates.filter(c => c !== primary && c.score >= c.threshold * 0.6);

  return { primary, secondary, candidates };
}

function renderArchetype(mons) {
  const el = $('#archetype');
  if (mons.length < 3) { el.innerHTML = ''; return; }
  const { primary, secondary } = detectArchetype(mons);

  let html;
  if (primary) {
    html = `<span class="arch-label">${primary.label}</span><span class="arch-evidence">${primary.evidence}.</span>`;
  } else {
    // Fallback: pace tells balance vs bulky offense apart.
    const entries = mons.map(m => byName.get(m.name).stats);
    const avgSpe = entries.reduce((s, e) => s + e.spe, 0) / entries.length;
    const label = avgSpe >= 85 ? 'Bulky Offense / Balance' : 'Balance';
    html = `<span class="arch-label">${label}</span><span class="arch-evidence">no strong archetype signal — no weather core, Trick Room mode, or dedicated pace detected (abilities and stats only; movesets not considered).</span>`;
  }
  if (secondary.length) {
    html += `<div class="arch-secondary">Secondary tendencies: ${secondary.map(s => `<b>${s.label}</b> (${s.evidence})`).join(' · ')}</div>`;
  }
  el.innerHTML = `<div class="arch-box">${html}</div>`;
}

// Suggest OU/Uber mons (not already on the team) that resist the given type, best BST first.
function suggestResisters(type, mons) {
  const picked = new Set(mons.map(m => m.name));
  return POKEMON_DATA
    .filter(p => !picked.has(p.name) && ['Uber', 'OU', 'UUBL'].includes(p.tier))
    .filter(p => effectiveness(type, p.types, p.abilities.length === 1 ? p.abilities[0] : null) < 1)
    .sort((a, b) => bst(b) - bst(a))
    .slice(0, 4);
}

function bst(p) {
  const s = p.stats;
  return s.hp + s.atk + s.def + s.spa + s.spd + s.spe;
}

// ---------- pair compatibility ----------
// For a pair (A, B): +1 per type one is weak to and the other resists (covered),
// -2 per type both are weak to (shared liability).
function pairSynergy(a, b) {
  const covered = [];   // { type, weak: name, saver: name }
  const shared = [];    // types both are weak to
  for (const atk of TYPES) {
    const ma = defenseMult(atk, a);
    const mb = defenseMult(atk, b);
    if (ma > 1 && mb > 1) shared.push(atk);
    else if (ma > 1 && mb < 1) covered.push({ type: atk, weak: a.name, saver: b.name });
    else if (mb > 1 && ma < 1) covered.push({ type: atk, weak: b.name, saver: a.name });
  }
  return { score: covered.length - 2 * shared.length, covered, shared };
}

function compatClass(score) {
  if (score >= 5) return 'c-res2';
  if (score >= 2) return 'c-res';
  if (score >= 0) return 'c-neutral';
  if (score >= -3) return 'c-weak';
  return 'c-weak2';
}

let compatSelection = null; // [i, j] indices into current mons, or null

function renderCompat(mons) {
  const table = $('#compat-table');
  const detail = $('#compat-detail');

  // Precompute synergies; track each member's average for the row summary.
  const syn = mons.map(() => []);
  for (let i = 0; i < mons.length; i++) {
    for (let j = i + 1; j < mons.length; j++) {
      syn[i][j] = pairSynergy(mons[i], mons[j]);
      syn[j][i] = syn[i][j];
    }
  }

  let html = '<thead><tr><th></th>';
  html += mons.map(m => `<th class="colhead" title="${m.name}">${m.name}</th>`).join('');
  html += '<th class="colhead">Avg</th></tr></thead><tbody>';

  for (let i = 0; i < mons.length; i++) {
    html += `<tr><th>${mons[i].name}</th>`;
    let sum = 0;
    for (let j = 0; j < mons.length; j++) {
      if (i === j) { html += '<td class="c-total">—</td>'; continue; }
      const s = syn[i][j];
      sum += s.score;
      const sel = compatSelection && ((compatSelection[0] === i && compatSelection[1] === j) || (compatSelection[0] === j && compatSelection[1] === i));
      html += `<td class="${compatClass(s.score)} compat-cell${sel ? ' selected' : ''}" data-i="${i}" data-j="${j}" role="button" tabindex="0" title="${mons[i].name} + ${mons[j].name}: ${s.score > 0 ? '+' : ''}${s.score}">${s.score > 0 ? '+' : ''}${s.score}</td>`;
    }
    const avg = sum / (mons.length - 1);
    html += `<td class="c-total">${avg >= 0 ? '+' : ''}${avg.toFixed(1)}</td></tr>`;
  }
  html += '</tbody>';
  table.innerHTML = html;

  const showDetail = (i, j) => {
    compatSelection = [i, j];
    const s = syn[i][j];
    const parts = [];
    if (s.covered.length) {
      parts.push('<b>Covered weaknesses:</b> ' + s.covered.map(c =>
        `${typeBadge(c.type)} (${c.weak} is weak, ${c.saver} resists)`).join(' · '));
    }
    if (s.shared.length) {
      parts.push('<b>Shared weaknesses:</b> ' + s.shared.map(typeBadge).join(' '));
    }
    if (!parts.length) parts.push('No overlapping weaknesses or covers — these two are type-independent.');
    detail.innerHTML = `<p class="compat-breakdown"><b>${mons[i].name} + ${mons[j].name}</b> (score ${s.score > 0 ? '+' : ''}${s.score}): ${parts.join('<br>')}</p>`;
    table.querySelectorAll('.compat-cell').forEach(td => {
      const ti = +td.dataset.i, tj = +td.dataset.j;
      td.classList.toggle('selected', (ti === i && tj === j) || (ti === j && tj === i));
    });
  };

  table.querySelectorAll('.compat-cell').forEach(td => {
    td.addEventListener('click', () => showDetail(+td.dataset.i, +td.dataset.j));
    td.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showDetail(+td.dataset.i, +td.dataset.j); }
    });
  });

  // Keep breakdown in sync when team changes; drop stale selection.
  if (compatSelection && (compatSelection[0] >= mons.length || compatSelection[1] >= mons.length)) {
    compatSelection = null;
  }
  if (compatSelection) showDetail(compatSelection[0], compatSelection[1]);
  else detail.innerHTML = '';
}

// ---------- replacement finder ----------
// A single comparable score for a hypothetical team, built from the same
// signals the other cards show: offensive coverage, pair synergy, stacked
// weaknesses, unresisted types.
function teamMetrics(mons) {
  let stacked = 0, unresisted = 0, weakTotal = 0;
  const stackedTypes = [], unresistedTypes = [];
  for (const atk of TYPES) {
    let weak = 0, resist = 0;
    for (const m of mons) {
      const mult = defenseMult(atk, m);
      if (mult > 1) weak++;
      if (mult < 1) resist++;
    }
    weakTotal += weak;
    if (weak >= 3) { stacked += weak - 2; stackedTypes.push(atk); }
    if (resist === 0 && weak > 0) { unresisted++; unresistedTypes.push(atk); }
  }
  const stabs = stabTypes(mons.map(m => ({ name: m.name, ability: m.ability })));
  let covered = 0;
  const uncoveredTypes = [];
  for (const def of TYPES) {
    let best = 0;
    for (const atk of stabs) best = Math.max(best, effectiveness(atk, [def], null));
    if (best >= 2) covered++; else uncoveredTypes.push(def);
  }
  let synergy = 0;
  for (let i = 0; i < mons.length; i++)
    for (let j = i + 1; j < mons.length; j++)
      synergy += pairSynergy(mons[i], mons[j]).score;

  const score = covered + synergy * 0.5 - stacked * 2 - unresisted * 1.5 - weakTotal * 0.25;
  return { score, covered, synergy, stacked, unresisted, stackedTypes, unresistedTypes, uncoveredTypes };
}

function candidateMon(p) {
  // Same convention as threat analysis: only apply an ability we can be sure of.
  return { name: p.name, ability: 0, _certainAbility: p.abilities.length === 1 };
}

function renderReplacement(mons) {
  const sel = $('#replace-member');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— choose a member —</option>' +
    mons.map((m, i) => `<option value="${i}">${m.name}</option>`).join('');
  if (prev !== '' && +prev < mons.length) sel.value = prev;
  renderReplacementResults(mons);
}

function renderReplacementResults(mons) {
  const out = $('#replace-results');
  const idx = $('#replace-member').value;
  if (idx === '') { out.innerHTML = ''; return; }

  const outgoing = mons[+idx];
  const rest = mons.filter((_, i) => i !== +idx);
  const includeUU = $('#replace-uu').checked;
  const tiers = includeUU ? ['Uber', 'OU', 'UUBL', 'UU'] : ['Uber', 'OU', 'UUBL'];
  const picked = new Set(mons.map(m => m.name));
  const current = teamMetrics(mons);

  const candidates = [];
  for (const p of POKEMON_DATA) {
    if (!tiers.includes(p.tier) || picked.has(p.name) || p.tier === 'NFE') continue;
    const trial = teamMetrics([...rest, candidateMon(p)]);
    candidates.push({ p, trial, delta: trial.score - current.score });
  }
  candidates.sort((a, b) => b.delta - a.delta || bst(b.p) - bst(a.p));

  const top = candidates.slice(0, 8);
  if (!top.length || top[0].delta <= 0) {
    out.innerHTML = `<p class="hint">No candidate in the selected tiers improves on ${outgoing.name} for this team's type profile — this slot is already well chosen.</p>`;
    if (!top.length) return;
  }

  out.innerHTML = top.map((c, ci) => {
    const reasons = [];
    const fixedStacked = current.stackedTypes.filter(t => !c.trial.stackedTypes.includes(t));
    const fixedUnres = current.unresistedTypes.filter(t => !c.trial.unresistedTypes.includes(t));
    const newCoverage = current.uncoveredTypes.filter(t => !c.trial.uncoveredTypes.includes(t));
    if (fixedStacked.length) reasons.push(`unstacks ${fixedStacked.map(typeBadge).join(' ')} weakness`);
    if (fixedUnres.length) reasons.push(`adds a resist to ${fixedUnres.map(typeBadge).join(' ')}`);
    if (newCoverage.length) reasons.push(`adds super-effective STAB vs ${newCoverage.map(typeBadge).join(' ')}`);
    if (c.trial.synergy > current.synergy) reasons.push(`pair synergy ${current.synergy >= 0 ? '+' : ''}${current.synergy} → +${c.trial.synergy}`);
    if (!reasons.length) reasons.push('fewer total weaknesses across the team');
    return `
    <div class="threat">
      <span class="threat-name">${c.p.name} <span class="mon-tier">${c.p.tier}</span></span>
      ${c.p.types.map(typeBadge).join(' ')}
      <span class="threat-detail">${reasons.join(' · ')}</span>
      <span class="threat-score">team score ${c.delta > 0 ? '+' : ''}${c.delta.toFixed(1)}</span>
      <button class="btn btn-swap" data-ci="${ci}">Swap in</button>
    </div>`;
  }).join('');

  out.querySelectorAll('.btn-swap').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = top[+btn.dataset.ci];
      const slotIdx = team.findIndex(m => m && m.name === outgoing.name);
      if (slotIdx >= 0) {
        team[slotIdx] = { name: c.p.name, ability: 0 };
        $('#replace-member').value = '';
        renderTeam();
      }
    });
  });
}

// ---------- threat analysis ----------
function renderThreats(mons) {
  const includeUU = $('#threat-uu').checked;
  const tiers = includeUU ? ['Uber', 'OU', 'UUBL', 'UU'] : ['Uber', 'OU', 'UUBL'];
  const picked = new Set(mons.map(m => m.name));

  const threats = [];
  for (const p of POKEMON_DATA) {
    if (!tiers.includes(p.tier) || picked.has(p.name)) continue;

    // Offensive pressure: members this mon hits super-effectively with its best STAB.
    let hits = 0;
    for (const m of mons) {
      const target = byName.get(m.name);
      let best = 0;
      for (const atk of p.types) {
        best = Math.max(best, effectiveness(atk, target.types, monAbility(m)));
      }
      if (best >= 2) hits++;
    }

    // Defensive pressure: our STAB types this mon resists or is immune to.
    const ourStabs = stabTypes(mons);
    let walls = 0;
    for (const atk of ourStabs) {
      if (effectiveness(atk, p.types, p.abilities.length === 1 ? p.abilities[0] : null) < 1) walls++;
    }

    const score = hits * 2 + walls;
    if (hits >= 2) threats.push({ p, hits, walls, score });
  }

  threats.sort((a, b) => b.score - a.score || bst(b.p) - bst(a.p));

  const list = $('#threat-list');
  if (!threats.length) {
    list.innerHTML = '<p class="hint">No single Pokémon in the selected tiers hits 2+ of your members super-effectively with STAB. Solid defensive core.</p>';
    return;
  }
  list.innerHTML = threats.slice(0, 12).map(t => `
    <div class="threat">
      <span class="threat-name">${t.p.name} <span class="mon-tier">${t.p.tier}</span></span>
      ${t.p.types.map(typeBadge).join(' ')}
      <span class="threat-detail">hits ${t.hits}/${mons.length} members super-effectively${t.walls ? ` · resists ${t.walls} of your STAB types` : ''}</span>
      <span class="threat-score">threat score ${t.score}</span>
    </div>`).join('');
}

// ---------- sample & clear ----------
const SAMPLE_TEAM = ['Gholdengo', 'Garchomp-Mega', 'Gyarados-Mega', 'Rotom-Wash', 'Kommo-o', 'Clefable-Mega'];

$('#btn-sample').addEventListener('click', () => {
  team = SAMPLE_TEAM.map(n => byName.has(n) ? { name: n, ability: 0 } : null);
  renderTeam();
});
$('#btn-clear').addEventListener('click', () => {
  team = Array(SLOTS).fill(null);
  renderTeam();
});
$('#threat-uu').addEventListener('change', () => {
  const mons = team.filter(Boolean);
  if (mons.length) renderThreats(mons);
});
$('#replace-member').addEventListener('change', () => {
  const mons = team.filter(Boolean);
  if (mons.length >= 2) renderReplacementResults(mons);
});
$('#replace-uu').addEventListener('change', () => {
  const mons = team.filter(Boolean);
  if (mons.length >= 2) renderReplacementResults(mons);
});

// ---------- Showdown import/export ----------
$('#btn-import').addEventListener('click', () => {
  const sec = $('#import-section');
  sec.hidden = !sec.hidden;
  if (!sec.hidden) $('#import-text').focus();
});
$('#btn-do-import').addEventListener('click', () => {
  const status = $('#import-status');
  const text = $('#import-text').value;
  if (!text.trim()) { status.textContent = 'Paste a team first.'; return; }
  const { entries, errors } = parseShowdownTeam(text);
  if (!entries.length) {
    status.textContent = errors.length ? errors.join(' ') : 'No Pokémon recognized in that paste.';
    return;
  }
  team = Array(SLOTS).fill(null);
  entries.forEach((e, i) => { team[i] = { name: e.species, ability: e.ability, set: e.set }; });
  renderTeam();
  status.textContent = `Imported ${entries.length} Pokémon.` + (errors.length ? ' ' + errors.join(' ') : '');
});
async function copyExport() {
  const status = $('#import-status');
  const mons = team.filter(Boolean);
  if (!mons.length) { status.textContent = 'No team to export.'; return; }
  const text = exportShowdownTeam(team);
  $('#import-text').value = text;
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Copied to clipboard.';
  } catch (e) {
    status.textContent = 'Clipboard unavailable — paste is in the box above.';
  }
}
$('#btn-copy-export').addEventListener('click', copyExport);
$('#btn-export').addEventListener('click', () => {
  $('#import-section').hidden = false;
  copyExport();
});

// ---------- damage calculator events ----------
$('#dmg-attacker').addEventListener('change', () => renderDamageResults(team.filter(Boolean)));
['#dmg-doubles', '#dmg-weather', '#dmg-terrain'].forEach(sel => {
  $(sel).addEventListener('change', () => renderDamageResults(team.filter(Boolean)));
});
attachDefenderPicker();

renderTeam();
