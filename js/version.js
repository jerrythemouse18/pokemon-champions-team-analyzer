// Version badge — shows the latest commit of the deployed branch, linking to
// the repo's commit history. Fetched client-side from the GitHub API (no
// build step to inject a version), cached per session to stay well under the
// unauthenticated rate limit. Fails silent: no badge when offline/rate-limited.

const REPO = 'jerrythemouse18/pokemon-champions-team-analyzer';
const BRANCH = 'master';

(function versionBadge() {
  const el = document.querySelector('#version-badge');
  if (!el) return;

  const render = c => {
    const date = new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    el.innerHTML =
      `<a href="https://github.com/${REPO}/commits/${BRANCH}" target="_blank" rel="noopener" ` +
      `title="${c.message.split('\n')[0].replace(/"/g, '&quot;')} — click for commit history">` +
      `<span class="vb-dot"></span>${c.sha.slice(0, 7)} · ${date}</a>`;
  };

  try {
    const cached = sessionStorage.getItem('version-badge');
    if (cached) { render(JSON.parse(cached)); return; }
  } catch (e) { /* storage unavailable — fall through to fetch */ }

  fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(j => {
      const c = { sha: j.sha, date: j.commit.committer.date, message: j.commit.message };
      try { sessionStorage.setItem('version-badge', JSON.stringify(c)); } catch (e) { /* ignore */ }
      render(c);
    })
    .catch(() => { /* offline, local dev, or rate-limited — leave badge empty */ });
})();
