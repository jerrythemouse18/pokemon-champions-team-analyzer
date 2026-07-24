// Per-Pokémon set editor — click a team slot to edit ability, item, nature,
// level, EVs/IVs, and moves. Saves into team[slot].set (same shape as a
// Showdown import), so the damage calculator and export pick it up unchanged.

const EDITOR_STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
// Champions budgets 66 stat units (= 528 EV-equivalents at ×8), more than the
// mainline 508. Usage-stat spreads convert to up to 520 after per-stat caps.
const MAX_EV_TOTAL = 528;

let editorSlot = null; // team index being edited, or null

function _editorEl() {
  let overlay = document.querySelector('#set-editor-overlay');
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'set-editor-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="set-editor" role="dialog" aria-modal="true" aria-label="Edit set">
      <div class="se-head">
        <div class="se-title"></div>
        <button class="remove se-close" aria-label="Close editor">×</button>
      </div>
      <div class="se-grid">
        <label>Ability <select class="se-ability"></select></label>
        <label>Item <input class="se-item" list="se-items-list" placeholder="e.g. Choice Specs"></label>
        <label>Nature <select class="se-nature"></select></label>
        <label>Level <input class="se-level" type="number" min="1" max="100" step="1"></label>
      </div>
      <table class="se-stats">
        <thead><tr><th></th><th>HP</th><th>Atk</th><th>Def</th><th>SpA</th><th>SpD</th><th>Spe</th></tr></thead>
        <tbody>
          <tr class="se-base"><th>Base</th></tr>
          <tr class="se-evs"><th>EVs</th></tr>
          <tr class="se-ivs"><th>IVs</th></tr>
          <tr class="se-final"><th>Stat</th></tr>
        </tbody>
      </table>
      <div class="se-ev-total"></div>
      <div class="se-moves">
        ${[0, 1, 2, 3].map(i => `<input class="se-move" data-mi="${i}" list="se-moves-list" placeholder="Move ${i + 1}">`).join('')}
      </div>
      <div class="se-common" hidden>
        <div class="se-common-title">Most common doubles moves <span class="se-common-src"></span></div>
        <div class="se-common-list"></div>
      </div>
      <div class="se-actions">
        <button class="btn se-save">Save</button>
        <button class="btn btn-ghost se-cancel">Cancel</button>
        <span class="hint se-error"></span>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Shared datalists for item and move autocomplete, filled from the calc dex once.
  if (window.SmogonCalc) {
    const gen = window.SmogonCalc.Generations.get(9);
    const items = document.createElement('datalist');
    items.id = 'se-items-list';
    for (const it of gen.items) items.appendChild(new Option(it.name));
    document.body.appendChild(items);

    const moves = document.createElement('datalist');
    moves.id = 'se-moves-list';
    for (const mv of gen.moves) { if (mv.name !== '(No Move)') moves.appendChild(new Option(mv.name)); }
    document.body.appendChild(moves);

    const natSel = overlay.querySelector('.se-nature');
    const label = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' };
    for (const n of gen.natures) {
      const neutral = n.plus === n.minus;
      natSel.appendChild(new Option(neutral ? n.name : `${n.name} (+${label[n.plus]} −${label[n.minus]})`, n.name));
    }
  }

  // EV/IV rows: one numeric input per stat.
  for (const [row, max] of [['se-evs', 252], ['se-ivs', 31]]) {
    const tr = overlay.querySelector('.' + row);
    for (const st of EDITOR_STATS) {
      const td = document.createElement('td');
      td.innerHTML = `<input type="number" min="0" max="${max}" step="${max === 252 ? 4 : 1}" data-stat="${st}">`;
      tr.appendChild(td);
    }
  }

  overlay.addEventListener('click', e => { if (e.target === overlay) closeSetEditor(); });
  overlay.querySelector('.se-close').addEventListener('click', closeSetEditor);
  overlay.querySelector('.se-cancel').addEventListener('click', closeSetEditor);
  overlay.querySelector('.se-save').addEventListener('click', saveSetEditor);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeSetEditor(); });
  overlay.querySelectorAll('.se-evs input, .se-ivs input').forEach(inp =>
    inp.addEventListener('input', updateEditorStats));
  ['.se-nature', '.se-level'].forEach(sel =>
    overlay.querySelector(sel).addEventListener('input', updateEditorStats));

  return overlay;
}

function openSetEditor(slotIdx) {
  const mon = team[slotIdx];
  if (!mon) return;
  const p = byName.get(mon.name);
  const set = mon.set || {};
  const overlay = _editorEl();

  overlay.querySelector('.se-title').innerHTML =
    `${p.name} <span class="mon-tier">${p.tier}</span> ${p.types.map(typeBadge).join(' ')}`;

  const abilitySel = overlay.querySelector('.se-ability');
  abilitySel.innerHTML = '';
  p.abilities.forEach((a, ai) => {
    abilitySel.appendChild(new Option(a + (ABILITY_MODIFIERS[a] ? ' ★' : ''), ai));
  });
  abilitySel.value = mon.ability || 0;

  overlay.querySelector('.se-item').value = set.item || '';
  overlay.querySelector('.se-nature').value = set.nature || 'Serious';
  overlay.querySelector('.se-level').value = set.level || 50;

  overlay.querySelectorAll('.se-evs input').forEach(inp => {
    inp.value = (set.evs && set.evs[inp.dataset.stat]) || 0;
  });
  overlay.querySelectorAll('.se-ivs input').forEach(inp => {
    const iv = set.ivs && set.ivs[inp.dataset.stat];
    inp.value = iv == null ? 31 : iv;
  });

  const base = overlay.querySelector('.se-base');
  base.innerHTML = '<th>Base</th>' + EDITOR_STATS.map(st => `<td>${p.stats[st]}</td>`).join('');

  overlay.querySelectorAll('.se-move').forEach(inp => {
    inp.value = (set.moves && set.moves[+inp.dataset.mi]) || '';
  });

  renderCommonMoves(overlay, mon.name);

  overlay.querySelector('.se-error').textContent = '';
  editorSlot = slotIdx;
  overlay.hidden = false;
  updateEditorStats();
}

// Usage-ranked move chips: click to fill the first empty move slot (or
// replace the last slot when full); a filled move's chip removes it again.
function renderCommonMoves(overlay, name) {
  const box = overlay.querySelector('.se-common');
  const list = overlay.querySelector('.se-common-list');
  const ms = movesetFor(name);
  if (!ms) { box.hidden = true; return; }

  overlay.querySelector('.se-common-src').textContent =
    ms.source === 'vgc' ? `(Champions VGC ladder, ${ms.usage}% usage)` : '(4v4 doubles UU ladder)';

  const moveInputs = () => [...overlay.querySelectorAll('.se-move')];
  const chosen = () => moveInputs().map(i => i.value.trim()).filter(Boolean);

  const redraw = () => {
    const current = chosen();
    list.innerHTML = '';
    for (const m of ms.moves) {
      const meta = typeof MOVE_META !== 'undefined' ? MOVE_META[m.name] : null;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'se-move-chip' + (current.includes(m.name) ? ' picked' : '');
      chip.innerHTML = `${meta ? `<span class="type-badge" style="background:${TYPE_COLORS[meta.type]}">${meta.type}</span> ` : ''}${m.name} <span class="se-pct">${m.pct}%</span>`;
      chip.addEventListener('click', () => {
        const inputs = moveInputs();
        const existing = inputs.find(i => i.value.trim() === m.name);
        if (existing) { existing.value = ''; }
        else {
          const empty = inputs.find(i => !i.value.trim());
          (empty || inputs[inputs.length - 1]).value = m.name;
        }
        redraw();
      });
      list.appendChild(chip);
    }
  };

  moveInputs().forEach(inp => { inp.oninput = redraw; });
  redraw();
  box.hidden = false;
}

function closeSetEditor() {
  const overlay = document.querySelector('#set-editor-overlay');
  if (overlay) overlay.hidden = true;
  editorSlot = null;
}

function _readEditor(overlay) {
  const evs = {}, ivs = {};
  overlay.querySelectorAll('.se-evs input').forEach(inp => {
    const v = Math.max(0, Math.min(252, parseInt(inp.value, 10) || 0));
    if (v) evs[inp.dataset.stat] = v;
  });
  overlay.querySelectorAll('.se-ivs input').forEach(inp => {
    const v = inp.value === '' ? 31 : Math.max(0, Math.min(31, parseInt(inp.value, 10)));
    if (v !== 31) ivs[inp.dataset.stat] = v;
  });
  return {
    ability: parseInt(overlay.querySelector('.se-ability').value, 10) || 0,
    item: overlay.querySelector('.se-item').value.trim() || null,
    nature: overlay.querySelector('.se-nature').value,
    level: Math.max(1, Math.min(100, parseInt(overlay.querySelector('.se-level').value, 10) || 50)),
    evs, ivs,
    moves: [...overlay.querySelectorAll('.se-move')].map(i => i.value.trim()).filter(Boolean),
  };
}

function updateEditorStats() {
  const overlay = document.querySelector('#set-editor-overlay');
  if (editorSlot === null || overlay.hidden) return;
  const mon = team[editorSlot];
  const p = byName.get(mon.name);
  const r = _readEditor(overlay);

  const evTotal = Object.values(r.evs).reduce((s, v) => s + v, 0);
  const totalEl = overlay.querySelector('.se-ev-total');
  totalEl.textContent = `EVs used: ${evTotal} / ${MAX_EV_TOTAL}`;
  totalEl.classList.toggle('over', evTotal > MAX_EV_TOTAL);

  const finalRow = overlay.querySelector('.se-final');
  if (!window.SmogonCalc) { finalRow.innerHTML = '<th>Stat</th>'; return; }
  try {
    const calcMon = toCalcPokemon(
      { name: mon.name, ability: r.ability, set: { level: r.level, nature: r.nature, evs: r.evs, ivs: r.ivs } }, p);
    finalRow.innerHTML = '<th>Stat</th>' + EDITOR_STATS.map(st => {
      const gen = window.SmogonCalc.Generations.get(9);
      const nat = gen.natures.get(window.SmogonCalc.toID(r.nature));
      const cls = nat && nat.plus !== nat.minus && st === nat.plus ? 'se-plus'
        : nat && nat.plus !== nat.minus && st === nat.minus ? 'se-minus' : '';
      return `<td class="${cls}">${calcMon.stats[st]}</td>`;
    }).join('');
  } catch (e) {
    finalRow.innerHTML = '<th>Stat</th>' + EDITOR_STATS.map(() => '<td>—</td>').join('');
  }
}

function saveSetEditor() {
  const overlay = document.querySelector('#set-editor-overlay');
  if (editorSlot === null) return;
  const mon = team[editorSlot];
  const p = byName.get(mon.name);
  const r = _readEditor(overlay);
  const err = overlay.querySelector('.se-error');

  const evTotal = Object.values(r.evs).reduce((s, v) => s + v, 0);
  if (evTotal > MAX_EV_TOTAL) { err.textContent = `EV total ${evTotal} exceeds ${MAX_EV_TOTAL}.`; return; }

  // Unrecognized move names would silently confuse the damage calc — reject early.
  if (window.SmogonCalc) {
    const gen = window.SmogonCalc.Generations.get(9);
    const bad = r.moves.filter(mv => !gen.moves.get(window.SmogonCalc.toID(mv)));
    if (bad.length) { err.textContent = `Unknown move: ${bad.join(', ')}.`; return; }
    if (r.item && !gen.items.get(window.SmogonCalc.toID(r.item))) {
      err.textContent = `Unknown item: ${r.item}.`; return;
    }
  }

  mon.ability = r.ability;
  const prev = mon.set || {};
  mon.set = {
    item: r.item,
    level: r.level,
    evs: r.evs,
    ivs: r.ivs,
    nature: r.nature,
    moves: r.moves,
    ability: p.abilities[r.ability] || p.abilities[0],
    teraType: prev.teraType || null, // not editable here, but keep imported value
  };
  closeSetEditor();
  renderTeam();
}
