// Team-vs-team matchup matrix. Enter an opposing team of 6 (autocomplete or
// Showdown paste); each cell nets your member's best damage into theirs
// against their best damage back, using the same calc engine and set
// conventions as the damage calculator (saved sets for you, common ladder
// sets for them).

let oppTeam = Array(6).fill(null); // dex entries (with optional .set from paste)
let vsMatrix = null; // { mons, opps, nets[i][j] } cached by renderVersus for the game plan
let planMode = 'A'; // 'A' = counter their predicted 4, 'B' = my best 4 vs their whole 6

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
  const nets = mons.map(() => Array(opps.length).fill(0));
  for (const [i, m] of mons.entries()) {
    let rowSum = 0;
    let row = `<th>${spriteImg(m.name, 'sprite-sm')} ${m.name}</th>`;
    opps.forEach((o, j) => {
      const { net, mine, theirs } = vsCellScore(m, o);
      nets[i][j] = net;
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

  vsMatrix = { mons, opps, nets };
  renderGamePlan();
}

// ---------- game plan: pick-4 + leads for both sides ----------
// All 4-subsets of indices 0..n-1 (n <= 6 -> at most 15 subsets).
function subsets4(n) {
  const out = [];
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) out.push([a, b, c, d]);
  return n >= 4 ? out : [Array.from({ length: n }, (_, i) => i)];
}

// Best 4-subset of rows against a set of columns, on a nets matrix
// (higher = better for the row side). Score = sum over columns of the
// best net any picked row has into that column — "someone answers everything" —
// plus a small term for overall average.
function bestFour(nets, rowCount, colIdxs) {
  let bestSet = null, bestScore = -Infinity;
  for (const subset of subsets4(rowCount)) {
    let score = 0;
    for (const j of colIdxs) {
      let colBest = -Infinity, colSum = 0;
      for (const i of subset) { colBest = Math.max(colBest, nets[i][j]); colSum += nets[i][j]; }
      score += colBest + colSum / subset.length * 0.25;
    }
    if (score > bestScore) { bestScore = score; bestSet = subset; }
  }
  return { subset: bestSet, score: bestScore };
}

// Leads among a picked 4: reuse the lead-pair scorer for our side; for the
// opposing side (no user sets) use matchup nets + support-move heuristics
// from their common ladder moves.
function bestLeadsFromFour(mons, subset) {
  const infos = subset.map(i => leadInfo(mons[i]));
  let best = null, bestScore = -Infinity;
  for (let x = 0; x < infos.length; x++)
    for (let y = x + 1; y < infos.length; y++) {
      const { score } = scoreLeadPair(infos[x], infos[y]);
      if (score > bestScore) { bestScore = score; best = [infos[x].mon.name, infos[y].mon.name]; }
    }
  return best;
}

function bestOppLeads(opps, subset, nets, myIdxs) {
  // Opponent leads: prefer pairs with support moves in their common sets and
  // good average matchup into my side (their net = -nets).
  let best = null, bestScore = -Infinity;
  for (let x = 0; x < subset.length; x++)
    for (let y = x + 1; y < subset.length; y++) {
      const [j1, j2] = [subset[x], subset[y]];
      let score = 0;
      for (const i of myIdxs) score += (-nets[i][j1] - nets[i][j2]) / myIdxs.length;
      for (const j of [j1, j2]) {
        const ms = movesetFor(opps[j].name);
        const moves = (opps[j].set && opps[j].set.moves) || (ms ? ms.moves.slice(0, 4).map(m => m.name) : []);
        for (const mv of moves) { const s = SUPPORT_MOVES[mv]; if (s && s.pts) score += s.pts * 2; }
      }
      if (score > bestScore) { bestScore = score; best = [j1, j2]; }
    }
  return best;
}

function renderGamePlan() {
  const el = $('#vs-plan');
  const modeEl = $('#vs-plan-mode');
  const enough = vsMatrix && vsMatrix.opps.length >= 2 && vsMatrix.mons.length >= 2;
  modeEl.hidden = !enough;
  if (!enough) { el.innerHTML = ''; return; }
  const { mons, opps, nets } = vsMatrix;
  const allMine = mons.map((_, i) => i);
  const allTheirs = opps.map((_, j) => j);

  // Their best 4 against my full team (their nets = transpose, negated).
  const theirNets = opps.map((_, j) => mons.map((_, i) => -nets[i][j]));
  const theirPick = bestFour(theirNets, opps.length, allMine);
  const theirLeadIdx = bestOppLeads(opps, theirPick.subset, nets, allMine);

  // My pick depends on mode: A counters their predicted 4; B maximizes vs all 6.
  const targetCols = planMode === 'A' ? theirPick.subset : allTheirs;
  const myPick = bestFour(nets, mons.length, targetCols);
  const myLeads = bestLeadsFromFour(mons, myPick.subset);

  const monChip = name => `<span class="plan-mon">${spriteImg(name, 'sprite-sm')}${name}</span>`;
  const lead = (names) => names.map(n => `<b>${n}</b>`).join(' + ');

  el.innerHTML = `
    <div class="plan-grid">
      <div class="plan-side">
        <div class="plan-title">Your game plan ${planMode === 'A' ? '(countering their best 4)' : '(best vs their full 6)'}</div>
        <div class="plan-mons">${myPick.subset.map(i => monChip(mons[i].name)).join('')}</div>
        <div class="plan-leads">Lead with ${lead(myLeads)}${myPick.subset.map(i => mons[i].name).filter(n => !myLeads.includes(n)).length ? ` · back: ${myPick.subset.map(i => mons[i].name).filter(n => !myLeads.includes(n)).join(', ')}` : ''}</div>
      </div>
      <div class="plan-side plan-theirs">
        <div class="plan-title">Their most likely picks (best 4 vs your team)</div>
        <div class="plan-mons">${theirPick.subset.map(j => monChip(opps[j].name)).join('')}</div>
        <div class="plan-leads">Expect leads: ${lead(theirLeadIdx.map(j => opps[j].name))} · back: ${theirPick.subset.filter(j => !theirLeadIdx.includes(j)).map(j => opps[j].name).join(', ')}</div>
      </div>
    </div>`;
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
