// Lead-pair recommender — scores all pairs of the team as doubles leads.
// Signals: type synergy (pairSynergy), doubles support moves actually carried,
// spread damage, speed control, weather cores, and how often the pair really
// appears together on the Champions VGC ladder (teammate co-occurrence).

const SUPPORT_MOVES = {
  'Fake Out':      { pts: 3, tag: 'Fake Out pressure' },
  'Follow Me':     { pts: 3, tag: 'redirection' },
  'Rage Powder':   { pts: 3, tag: 'redirection' },
  'Tailwind':      { pts: 2.5, tag: 'Tailwind speed control' },
  'Trick Room':    { pts: 2.5, tag: 'Trick Room setup' },
  'Icy Wind':      { pts: 1.5, tag: 'speed control' },
  'Electroweb':    { pts: 1.5, tag: 'speed control' },
  'Helping Hand':  { pts: 1.5, tag: 'Helping Hand support' },
  'Wide Guard':    { pts: 1.5, tag: 'Wide Guard' },
  'Coaching':      { pts: 1, tag: 'Coaching support' },
  'Decorate':      { pts: 2, tag: 'Decorate support' },
  'Intimidate':    { pts: 0, tag: '' }, // ability, handled separately
};

const WEATHER_PAIRS = {
  Drizzle: ['Swift Swim', 'Rain Dish', 'Hydration'],
  Drought: ['Chlorophyll', 'Solar Power', 'Protosynthesis'],
  'Sand Stream': ['Sand Rush', 'Sand Force'],
  'Snow Warning': ['Slush Rush', 'Ice Body'],
};

function leadInfo(mon) {
  const p = byName.get(mon.name);
  const moves = (mon.set && mon.set.moves) || [];
  const ability = monAbility(mon);
  const support = [];
  let supportPts = 0;
  for (const mv of moves) {
    const s = SUPPORT_MOVES[mv];
    if (s && s.pts) { support.push(s.tag); supportPts += s.pts; }
  }
  const spread = moves.filter(mv => {
    const meta = typeof MOVE_META !== 'undefined' && MOVE_META[mv];
    return meta && (meta.target === 'AllAdjacentFoes' || meta.target === 'AllAdjacent') && meta.power > 0;
  });
  const speed = typeof memberSpeed === 'function' ? memberSpeed(mon, false) : p.stats.spe;
  const offense = Math.max(p.stats.atk, p.stats.spa);
  return { mon, p, moves, ability, support, supportPts, spread, speed, offense };
}

function scoreLeadPair(a, b) {
  const reasons = [];
  let score = 0;

  // 1. Type synergy (existing pair score, weight 1.0; range roughly -8..+8)
  const syn = pairSynergy(a.mon, b.mon);
  score += syn.score;
  if (syn.score >= 3) reasons.push(`strong type synergy (+${syn.score})`);
  else if (syn.score <= -3) reasons.push(`shared weaknesses (${syn.score})`);

  // 2. Support + offense balance: best leads pair a support mon with a hitter.
  score += a.supportPts + b.supportPts;
  const supportTags = [...new Set([...a.support, ...b.support])];
  if (supportTags.length) reasons.push(supportTags.join(', '));
  const hasHitter = a.offense >= 120 || b.offense >= 120;
  const hasSupport = a.supportPts >= 2 || b.supportPts >= 2;
  if (hasHitter && hasSupport) { score += 3; reasons.push('support + heavy hitter core'); }

  // 3. Spread damage
  const spreadMoves = [...a.spread, ...b.spread];
  if (spreadMoves.length) { score += Math.min(spreadMoves.length, 2); reasons.push(`spread damage (${[...new Set(spreadMoves)].slice(0, 2).join(', ')})`); }

  // 4. Weather core
  for (const [setter, abusers] of Object.entries(WEATHER_PAIRS)) {
    if ((a.ability === setter && abusers.includes(b.ability)) ||
        (b.ability === setter && abusers.includes(a.ability))) {
      score += 5;
      reasons.push(`weather core (${setter} + ${a.ability === setter ? b.ability : a.ability})`);
    }
  }

  // 5. Intimidate support
  if (a.ability === 'Intimidate' || b.ability === 'Intimidate') { score += 2; reasons.push('Intimidate'); }

  // 6. Ladder co-occurrence: do real teams actually run these two together?
  const msA = movesetFor(a.mon.name), msB = movesetFor(b.mon.name);
  const co = Math.max(
    (msA && msA.teammates && msA.teammates[b.mon.name]) || 0,
    (msB && msB.teammates && msB.teammates[a.mon.name]) || 0);
  if (co >= 30) { score += 4; reasons.push(`common ladder pairing (${co}% co-occurrence)`); }
  else if (co >= 10) { score += 2; reasons.push(`seen together on ladder (${co}%)`); }

  // 7. Ground-move friendly-fire: Earthquake next to a non-immune partner.
  for (const [x, y] of [[a, b], [b, a]]) {
    const eq = x.moves.some(mv => {
      const meta = typeof MOVE_META !== 'undefined' && MOVE_META[mv];
      return meta && meta.target === 'AllAdjacent' && meta.power > 0;
    });
    if (eq && effectiveness('Ground', y.p.types, y.ability) > 0) {
      score -= 2;
      reasons.push(`${x.mon.name}'s spread move also hits ${y.mon.name}`);
    }
  }

  // 8. Trick Room coherence: TR setter + slow hitter.
  const hasTR = a.moves.includes('Trick Room') || b.moves.includes('Trick Room');
  if (hasTR && Math.min(a.speed, b.speed) <= 60 && (a.offense >= 110 || b.offense >= 110)) {
    score += 3;
    reasons.push('Trick Room + slow hitter');
  }

  return { score, reasons };
}

function renderLeads(mons) {
  const el = $('#leads-results');
  if (mons.length < 2) { el.innerHTML = ''; return; }

  const infos = mons.map(leadInfo);
  const pairs = [];
  for (let i = 0; i < infos.length; i++) {
    for (let j = i + 1; j < infos.length; j++) {
      const { score, reasons } = scoreLeadPair(infos[i], infos[j]);
      pairs.push({ a: infos[i], b: infos[j], score, reasons });
    }
  }
  pairs.sort((x, y) => y.score - x.score);

  el.innerHTML = pairs.slice(0, 3).map((pr, idx) => `
    <div class="lead-pair${idx === 0 ? ' lead-best' : ''}">
      <div class="lead-rank">${idx === 0 ? '★ Best lead' : '#' + (idx + 1)}</div>
      <div class="lead-mons">
        ${spriteImg(pr.a.mon.name, 'sprite-slot')}
        <span class="lead-plus">+</span>
        ${spriteImg(pr.b.mon.name, 'sprite-slot')}
        <div class="lead-names"><b>${pr.a.mon.name}</b> + <b>${pr.b.mon.name}</b>
          <span class="threat-score">lead score ${pr.score.toFixed(1)}</span></div>
      </div>
      <div class="lead-reasons">${pr.reasons.length ? pr.reasons.join(' · ') : 'no notable synergy signals'}</div>
    </div>`).join('');
}
