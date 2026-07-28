// Sticky team strip — a compact always-visible team readout that appears once
// the team builder scrolls out of view. Click a member to jump back up and
// open its set editor.

(function teamStrip() {
  const strip = document.querySelector('#team-strip');
  const monsEl = document.querySelector('#strip-mons');
  const teamSection = document.querySelector('#team-section');
  if (!strip || !teamSection) return;

  let visible = false;

  const io = new IntersectionObserver(entries => {
    const teamVisible = entries[0].isIntersecting;
    const hasTeam = team.some(Boolean);
    strip.hidden = teamVisible || !hasTeam;
    visible = !strip.hidden;
    if (visible) fill();
  }, { rootMargin: '-40px 0px 0px 0px' });
  io.observe(teamSection);

  function fill() {
    monsEl.innerHTML = '';
    team.forEach((mon, i) => {
      if (!mon) return;
      const btn = document.createElement('button');
      btn.className = 'strip-mon';
      btn.innerHTML = `${spriteImg(mon.name, '')}${mon.name}`;
      btn.title = `Edit ${mon.name}`;
      btn.addEventListener('click', () => {
        teamSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => openSetEditor(i), 350);
      });
      monsEl.appendChild(btn);
    });
  }

  // Re-fill when the team re-renders while the strip is showing.
  const origRenderTeam = window.renderTeam;
  window.renderTeam = function () {
    origRenderTeam.apply(this, arguments);
    if (visible) fill();
  };
})();
