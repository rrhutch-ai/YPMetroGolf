// ============================================================
// Par values for each hole 1–18 (index 0 = hole 1).
// Adjust to match your actual course. Default total is par 72.
// ============================================================
const PAR = [4,4,3,4,5,3,4,4,5, 4,3,4,5,4,3,5,4,4];

// ---- App State ----
let currentTeamId   = null;
let currentTeamData = null;
let teamsData       = {};
let saveTimer       = null;
let scoresListener  = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initTournamentInfo();
  initTeamsDropdown();
  initLeaderboard();

  document.getElementById('pin-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doTeamLogin();
  });
});

// ============================================================
// TOURNAMENT INFO BANNER
// ============================================================
function initTournamentInfo() {
  db.ref('tournament').on('value', snap => {
    const d = snap.val();
    if (!d) return;

    document.getElementById('header-title').textContent =
      `⛳ ${d.name || 'Golf Tournament'}`;
    document.getElementById('header-subtitle').textContent =
      d.date ? fmtDate(d.date) : '';

    // Show banner
    const banner = document.getElementById('tournament-banner');
    banner.classList.remove('hidden');
    document.getElementById('banner-name').textContent   = d.name   || '';
    document.getElementById('banner-date').textContent   = d.date   ? `📅 ${fmtDate(d.date)}`   : '';
    document.getElementById('banner-format').textContent = d.format ? `🏌️ ${d.format}` : '';

    const instrEl = document.getElementById('banner-instructions');
    if (d.instructions) {
      instrEl.textContent = d.instructions;
      instrEl.classList.remove('hidden');
    } else {
      instrEl.classList.add('hidden');
    }
  });
}

// ============================================================
// TEAMS DROPDOWN
// ============================================================
function initTeamsDropdown() {
  db.ref('teams').on('value', snap => {
    teamsData = snap.val() || {};
    const sel     = document.getElementById('team-select');
    const current = sel.value;

    sel.innerHTML = '<option value="">— Choose your team —</option>';

    // Sort by tee time
    Object.entries(teamsData)
      .sort((a, b) => (a[1].teeTime || '99:99').localeCompare(b[1].teeTime || '99:99'))
      .forEach(([id, team]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = team.name + (team.teeTime ? ` — ${fmtTime(team.teeTime)}` : '');
        sel.appendChild(opt);
      });

    if (current && teamsData[current]) sel.value = current;
  });
}

// ============================================================
// TEAM LOGIN
// ============================================================
function doTeamLogin() {
  const teamId = document.getElementById('team-select').value;
  const pin    = document.getElementById('pin-input').value.trim();

  if (!teamId) { showLoginError('Please select your team.'); return; }
  if (!pin)    { showLoginError('Please enter your team PIN.'); return; }

  const team = teamsData[teamId];
  if (!team)       { showLoginError('Team not found. Please refresh.'); return; }
  if (team.pin !== pin) { showLoginError('Incorrect PIN. Please try again.'); return; }

  currentTeamId   = teamId;
  currentTeamData = team;

  document.getElementById('team-login').classList.add('hidden');
  document.getElementById('scorecard-section').classList.remove('hidden');
  buildScorecard();
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function switchTeam() {
  // Detach live score listener for the old team
  if (scoresListener && currentTeamId) {
    db.ref(`scores/${currentTeamId}`).off('value', scoresListener);
    scoresListener = null;
  }
  currentTeamId   = null;
  currentTeamData = null;

  document.getElementById('scorecard-section').classList.add('hidden');
  document.getElementById('team-login').classList.remove('hidden');
  document.getElementById('pin-input').value  = '';
  document.getElementById('team-select').value = '';
}

// ============================================================
// SCORECARD
// ============================================================
function buildScorecard() {
  const team = currentTeamData;
  document.getElementById('sc-team-name').textContent = team.name;
  document.getElementById('sc-players').textContent   = (team.players || []).join(' · ');

  const teeEl = document.getElementById('sc-tee-info');
  const badges = [];
  if (team.startingHole) badges.push(`<span class="tee-badge">⛳ Starting Hole ${team.startingHole}</span>`);
  if (team.teeTime)      badges.push(`<span class="tee-badge">🕐 ${fmtTime(team.teeTime)}</span>`);
  teeEl.innerHTML = badges.join('');

  // Build hole cells
  const frontEl = document.getElementById('holes-front');
  const backEl  = document.getElementById('holes-back');
  frontEl.innerHTML = '';
  backEl.innerHTML  = '';

  for (let h = 1; h <= 18; h++) {
    const cell = document.createElement('div');
    cell.className = 'hole-cell';
    cell.innerHTML = `
      <div class="hole-number">Hole ${h}</div>
      <div class="hole-par">Par ${PAR[h - 1]}</div>
      <div class="score-stepper">
        <button class="stepper-btn stepper-dec" data-hole="${h}" type="button">−</button>
        <input
          type="number"
          class="hole-input"
          id="hole-${h}"
          min="1" max="15"
          placeholder="—"
          inputmode="numeric"
          data-hole="${h}"
        />
        <button class="stepper-btn stepper-inc" data-hole="${h}" type="button">+</button>
      </div>
    `;
    (h <= 9 ? frontEl : backEl).appendChild(cell);

    // Attach listeners after cell is in DOM
    const inp = document.getElementById(`hole-${h}`);
    inp.addEventListener('input', function () {
      applyScoreColor(this, PAR[h - 1]);
      refreshTotals();
      queueSave();
    });

    cell.querySelector('.stepper-dec').addEventListener('click', () => {
      const cur = parseInt(inp.value);
      inp.value = isNaN(cur) ? 1 : Math.max(1, cur - 1);
      applyScoreColor(inp, PAR[h - 1]);
      refreshTotals();
      queueSave();
    });

    cell.querySelector('.stepper-inc').addEventListener('click', () => {
      const cur = parseInt(inp.value);
      inp.value = isNaN(cur) ? 1 : Math.min(15, cur + 1);
      applyScoreColor(inp, PAR[h - 1]);
      refreshTotals();
      queueSave();
    });
  }

  // Load existing scores then start live-sync
  db.ref(`scores/${currentTeamId}`).once('value').then(snap => {
    applyScoreSnapshot(snap.val() || {});
    refreshTotals();
    startScoresSync();
  });
}

function startScoresSync() {
  // Keep scorecard in sync if another device updates scores
  scoresListener = db.ref(`scores/${currentTeamId}`).on('value', snap => {
    const scores = snap.val() || {};
    for (let h = 1; h <= 18; h++) {
      const inp = document.getElementById(`hole-${h}`);
      if (!inp || document.activeElement === inp) continue; // don't overwrite while user is typing
      const saved = scores[`hole${h}`];
      inp.value = saved !== undefined ? saved : '';
      applyScoreColor(inp, PAR[h - 1]);
    }
    refreshTotals();
  });
}

function applyScoreSnapshot(scores) {
  for (let h = 1; h <= 18; h++) {
    const inp = document.getElementById(`hole-${h}`);
    if (!inp) continue;
    const val = scores[`hole${h}`];
    if (val !== undefined) {
      inp.value = val;
      applyScoreColor(inp, PAR[h - 1]);
    }
  }
}

// Score color coding relative to par
function applyScoreColor(input, par) {
  input.classList.remove('score-eagle', 'score-birdie', 'score-par', 'score-bogey', 'score-double');
  const v = parseInt(input.value);
  if (isNaN(v) || !par) return;
  const diff = v - par;
  if      (diff <= -2) input.classList.add('score-eagle');
  else if (diff === -1) input.classList.add('score-birdie');
  else if (diff ===  0) input.classList.add('score-par');
  else if (diff ===  1) input.classList.add('score-bogey');
  else                  input.classList.add('score-double');
}

function refreshTotals() {
  let front = 0, back = 0, fc = 0, bc = 0;
  for (let h = 1; h <= 18; h++) {
    const v = parseInt(document.getElementById(`hole-${h}`)?.value);
    if (!isNaN(v)) {
      if (h <= 9) { front += v; fc++; }
      else        { back  += v; bc++; }
    }
  }
  document.getElementById('front-total').textContent = fc ? front : '—';
  document.getElementById('back-total').textContent  = bc ? back  : '—';
  document.getElementById('sc-total').textContent    = (fc + bc) ? (front + back) : '—';
}

// ============================================================
// SAVE SCORES (debounced)
// ============================================================
function queueSave() {
  setSaveStatus('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistScores, 900);
}

function persistScores() {
  if (!currentTeamId) return;
  const scores = {};
  for (let h = 1; h <= 18; h++) {
    const raw = document.getElementById(`hole-${h}`)?.value;
    if (raw !== '' && raw !== undefined) {
      const n = parseInt(raw);
      if (!isNaN(n) && n >= 1 && n <= 15) scores[`hole${h}`] = n;
    }
  }
  db.ref(`scores/${currentTeamId}`).set(scores)
    .then(() => setSaveStatus('saved'))
    .catch(() => setSaveStatus('error'));
}

function setSaveStatus(status) {
  const el = document.getElementById('save-status');
  el.className = 'save-status';
  if (status === 'saving') {
    el.classList.add('saving');
    el.textContent = '⏳ Saving…';
  } else if (status === 'saved') {
    el.classList.add('saved');
    el.textContent = '✓ Saved';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.textContent = ''; }, 2500);
  } else {
    el.textContent = '⚠ Save failed — check connection';
  }
}

// ============================================================
// LIVE LEADERBOARD
// ============================================================
function initLeaderboard() {
  // Listen to both teams and scores simultaneously
  db.ref('teams').on('value',  tSnap => {
    db.ref('scores').once('value').then(sSnap => {
      renderLeaderboard(tSnap.val() || {}, sSnap.val() || {});
    });
  });
  db.ref('scores').on('value', sSnap => {
    db.ref('teams').once('value').then(tSnap => {
      renderLeaderboard(tSnap.val() || {}, sSnap.val() || {});
    });
  });
}

function renderLeaderboard(teams, scores) {
  const container = document.getElementById('leaderboard-content');
  const entries = Object.entries(teams).map(([id, team]) => {
    const ts = scores[id] || {};
    let total = 0, played = 0;
    for (let h = 1; h <= 18; h++) {
      const s = ts[`hole${h}`];
      if (s !== undefined) { total += s; played++; }
    }
    return { id, team, total, played };
  });

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📊</div>
        <p>No teams yet — the admin needs to add teams first.</p>
      </div>`;
    return;
  }

  // Sort: teams with holes played by score asc, then not-started by tee time
  entries.sort((a, b) => {
    if (a.played === 0 && b.played === 0)
      return (a.team.teeTime || '99:99').localeCompare(b.team.teeTime || '99:99');
    if (a.played === 0) return 1;
    if (b.played === 0) return -1;
    return a.total - b.total;
  });

  const rows = entries.map((entry, idx) => {
    const rank   = idx + 1;
    const started = entry.played > 0;

    // Row highlight for top 3 (only if they've started)
    const rowClass = started && rank <= 3 ? `lb-row-${rank}` : '';

    // Rank badge
    let badge;
    if (started && rank === 1) badge = `<span class="rank-badge rank-badge-1">1</span>`;
    else if (started && rank === 2) badge = `<span class="rank-badge rank-badge-2">2</span>`;
    else if (started && rank === 3) badge = `<span class="rank-badge rank-badge-3">3</span>`;
    else badge = `<span class="rank-badge rank-badge-n">${rank}</span>`;

    // Score display
    const scoreHtml = started
      ? `<span class="score-pill">${entry.total}</span>`
      : `<span class="score-pill score-pill-ns">—</span>`;

    const holesHtml = started
      ? `<div class="holes-played">${entry.played} / 18 holes</div>`
      : `<div class="holes-played">Not started</div>`;

    const teeHtml = entry.team.teeTime
      ? `<div class="team-players-small">🕐 ${fmtTime(entry.team.teeTime)} · Start hole ${entry.team.startingHole}</div>`
      : '';

    return `
      <tr class="${rowClass}">
        <td style="width:36px;">${badge}</td>
        <td>
          <strong>${esc(entry.team.name)}</strong>
          <div class="team-players-small">${(entry.team.players || []).map(esc).join(' · ')}</div>
          ${teeHtml}
        </td>
        <td style="white-space:nowrap;">
          ${scoreHtml}
          ${holesHtml}
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ============================================================
// TABS
// ============================================================
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`content-${tab}`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
}

// ============================================================
// UTILITIES
// ============================================================
function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

// Safe HTML escape
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}
