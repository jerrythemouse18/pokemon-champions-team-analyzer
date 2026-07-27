// Instant hover tooltip for matrix cells — native title tooltips have a 1-2s
// delay that reads as "not working". Any element with a data-tip attribute
// gets an immediate tooltip; keyboard focus shows the same content.

(function tooltipLayer() {
  const tip = document.createElement('div');
  tip.id = 'hover-tip';
  tip.hidden = true;
  document.body.appendChild(tip);

  let anchor = null;

  function show(el) {
    const text = el.dataset.tip;
    if (!text) return;
    anchor = el;
    tip.textContent = text;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const tr = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - tr.width / 2;
    x = Math.max(8, Math.min(x, window.innerWidth - tr.width - 8));
    let y = r.top - tr.height - 8;
    if (y < 8) y = r.bottom + 8; // flip below when clipped at the top
    tip.style.left = `${x + window.scrollX}px`;
    tip.style.top = `${y + window.scrollY}px`;
  }

  function hide(el) {
    if (el && el !== anchor) return;
    anchor = null;
    tip.hidden = true;
  }

  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    if (el) show(el);
  });
  document.addEventListener('mouseout', e => {
    const el = e.target.closest('[data-tip]');
    if (el) hide(el);
  });
  document.addEventListener('focusin', e => {
    const el = e.target.closest('[data-tip]');
    if (el) show(el);
  });
  document.addEventListener('focusout', e => {
    const el = e.target.closest('[data-tip]');
    if (el) hide(el);
  });
  window.addEventListener('scroll', () => hide(), { passive: true });
})();
