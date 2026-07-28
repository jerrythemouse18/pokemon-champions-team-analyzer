// Team-vs-team matchup matrix. Enter an opposing team of 6 (autocomplete or
// Showdown paste); each cell nets your member's best damage into theirs
// against their best damage back, using the same calc engine and set
// conventions as the damage calculator (saved sets for you, common ladder
// sets for them).

let oppTeam = Array(6).fill(null); // dex entries (with optional .set from paste)

function vsCellScore(myMon, opp) {
  // Best % either side deals with its move list; net = mine - theirs.
  const myDex = byName.get(myMon.name);
  const mySet = myMon.set || {};
  const oppSet = opp.set || (typeof defaultSet === 'function' ? defaultSet(opp.name) : null);

  const me = toCalcPokemon(myMon, myDex);
  const them = toCalcPokemon({ name: opp.name, ability: 0, set: oppSet || undefined }, opp);
  const field = new CALC.Field({ gameType: 'Doubles' });

  const bestPct = (attacker, defender, moves) => {
    let best = 0, bestMove = '';
    for (const mvName of moves || []) {
      try {
        const mv = new CALC.Move(CALC_GEN, mvName);
        if (mv.category === 'Status') continue;
        const r = CALC.calculate(CALC_GEN, attacker, defender, mv, field);
        const pct = r.range()[1] / defender.maxHP() * 100;
        if (pct > best) { best = pct; bestMove = mvName; }
      } catch (e) { /* unknown move — skip */ }
    }
    return { best, bestMove };
  };

  const myMoves = (mySet.moves && mySet.moves.length) ? mySet.moves : defaultMoves(myDex);
  const theirMoves = (oppSet && oppSet.moves && oppSet.moves.length) ? oppSet.moves : defaultMoves(opp);

  const mine = bestPct(me, them, myMoves);
  const theirs = bestPct(them, me, theirMoves);
  return { net: mine.best - theirs.best, mine, theirs };
}

function vsCellClass(net) {
  if (net >= 60) return 'c-immune';
  if (net >= 25) return 'c-res2';
  if (net >= 5) return 'c-res';
  if (net > -5) return 'c-neutral';
  if (net > -25) return 'c-weak';
  return 'c-weak2';
}

function renderVersus() {
  const mons = team.filter(Boolean);
  const opps = oppTeam.filter(Boolean);
  const table = $('#vs-table');
  const summary = $('#vs-summary');
  if (!mons.length || !opps.length) { table.innerHTML = ''; summary.innerHTML = ''; return; }

  let html = '<thead><tr><th>You ↓ / Them →</th>';
  html += opps.map(o => `<th class="colhead" title="${o.name}">${spriteImg(o.name, 'sprite-sm')}<br>${o.name}</th>`).join('');
  html += '<th class="colhead">Avg</th></tr></thead><tbody>';

  const colTotals = Array(opps.length).fill(0);
  const rowAvgs = [];
  for (const m of mons) {
    let rowSum = 0;
    let row = `<th>${spriteImg(m.name, 'sprite-sm')} ${m.name}</th>`;
    opps.forEach((o, j) => {
      const { net, mine, theirs } = vsCellScore(m, o);
      rowSum += net;
      colTotals[j] += net;
      const tip = `${m.name}: ${mine.bestMove || 'no attack'} ${mine.best.toFixed(0)}% → | ← ${o.name}: ${theirs.bestMove || 'no attack'} ${theirs.best.toFixed(0)}%`;
      row += `<td class="${vsCellClass(net)}" tabindex="0" data-tip="${tip.replace(/"/g, '&quot;')}">${net > 0 ? '+' : ''}${net.toFixed(0)}</td>`;
    });
    const avg = rowSum / opps.length;
    rowAvgs.push({ name: m.name, avg });
    row = `<tr>${row}<td class="c-total">${avg > 0 ? '+' : ''}${avg.toFixed(0)}</td></tr>`;
    html += row;
  }
  // Column footer: their side's average (negative = bad news for you).
  html += '<tr><th>Their edge</th>' + colTotals.map((t, j) => {
    const avg = t / mons.length;
    return `<td class="c-total">${avg > 0 ? '+' : ''}${avg.toFixed(0)}</td>`;
  }).join('') + '<td></td></tr>';
  html += '</tbody>';
  table.innerHTML = html;

  rowAvgs.sort((a, b) => b.avg - a.avg);
  const best = rowAvgs[0], worst = rowAvgs[rowAvgs.length - 1];
  const threats = colTotals.map((t, j) => ({ name: opps[j].name, avg: t / mons.length })).sort((a, b) => a.avg - b.avg);
  summary.innerHTML = `<b>${best.name}</b> is your best matchup into this team (avg ${best.avg > 0 ? '+' : ''}${best.avg.toFixed(0)}); ` +
    `<b>${worst.name}</b> struggles most (${worst.avg.toFixed(0)}). ` +
    `Their biggest problem for you: <b>${threats[0].name}</b> (${threats[0].avg > 0 ? '+' : ''}${threats[0].avg.toFixed(0)} net against your side).`;
}

function attachVersusUI() {
  const grid = $('#vs-grid');

  function renderSlots() {
    grid.innerHTML = '';
    oppTeam.forEach((o, i) => {
      const div = document.createElement('div');
      div.className = 'vs-slot';
      if (o) {
        div.innerHTML = `${spriteImg(o.name, 'sprite-sm')}<span>${o.name}</span><button class="remove" aria-label="Remove ${o.name}">×</button>`;
        div.querySelector('.remove').addEventListener('click', () => { oppTeam[i] = null; renderSlots(); renderVersus(); });
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Opponent ${i + 1}…`;
        input.setAttribute('aria-label', `Opposing Pokémon slot ${i + 1}`);
        const ac = document.createElement('div');
        ac.className = 'autocomplete';
        ac.hidden = true;
        div.appendChild(input);
        div.appendChild(ac);
        attachVsAutocomplete(input, ac, i, renderSlots);
      }
      grid.appendChild(div);
    });
  }

  function attachVsAutocomplete(input, ac, slotIdx, refreshSlots) {
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      ac.innerHTML = '';
      if (!q) { ac.hidden = true; return; }
      const taken = new Set(oppTeam.filter(Boolean).map(o => o.name));
      const matches = POKEMON_DATA.filter(p => p.name.toLowerCase().includes(q) && !taken.has(p.name)).slice(0, 10);
      if (!matches.length) { ac.hidden = true; return; }
      matches.forEach(p => {
        const item = document.createElement('div');
        item.className = 'ac-item';
        item.innerHTML = `<span class="ac-mon">${spriteImg(p.name, 'sprite-sm')}${p.name}</span><span class="ac-tier">${p.tier}</span>`;
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          oppTeam[slotIdx] = p;
          refreshSlots();
          renderVersus();
        });
        ac.appendChild(item);
      });
      ac.hidden = false;
    });
    input.addEventListener('blur', () => setTimeout(() => { ac.hidden = true; }, 150));
  }

  $('#vs-import').addEventListener('click', () => {
    const text = prompt('Paste the opposing team (Showdown export format):');
    if (!text) return;
    const { entries, errors } = parseShowdownTeam(text);
    oppTeam = Array(6).fill(null);
    entries.slice(0, 6).forEach((e, i) => {
      const dex = byName.get(e.species);
      oppTeam[i] = { ...dex, set: e.set };
    });
    renderSlots();
    renderVersus();
    if (errors.length) alert(errors.join('\n'));
  });
  $('#vs-clear').addEventListener('click', () => {
    oppTeam = Array(6).fill(null);
    renderSlots();
    renderVersus();
  });

  renderSlots();
}
