// ============================================================
// PLAYER APP — app.js
// ============================================================

let currentTeamId   = null;
let currentTeamData = null;
let scoresListener  = null;
let teamsListener   = null;

// ── View switcher ─────────────────────────────────────────────
function showView(name) {
  document.getElementById('landing-view').classList.add('hidden');
  document.getElementById('scorecard-view').classList.add('hidden');
  document.getElementById('leaderboard-view').classList.add('hidden');
  document.getElementById(`${name}-view`).classList.remove('hidden');
}

// ── Tournament settings ───────────────────────────────────────
function loadSettings() {
  db.ref('tournament/settings').on('value', snap => {
    const s = snap.val() || {};
    document.getElementById('t-name').textContent = s.name || 'Golf Tournament';

    const dateEl = document.getElementById('t-date');
    if (s.date) {
      // Format date nicely without timezone shift
      const [y, m, d] = s.date.split('-');
      dateEl.textContent = new Date(Number(y), Number(m) - 1, Number(d))
        .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } else {
      dateEl.textContent = '';
    }

    const instrEl = document.getElementById('t-instructions');
    if (s.instructions) {
      instrEl.innerHTML = s.instructions
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      instrEl.style.display = 'block';
    } else {
      instrEl.style.display = 'none';
    }
  });
}

// ── Team dropdown ─────────────────────────────────────────────
function loadTeams() {
  db.ref('tournament/teams').on('value', snap => {
    const teams = snap.val() || {};
    const sel   = document.getElementById('team-select');
    const prev  = sel.value;

    sel.innerHTML = '<option value="">— Select your team —</option>';
    Object.entries(teams)
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .forEach(([id, team]) => {
        const opt = document.createElement('option');
        opt.value       = id;
        opt.textContent = team.name;
        sel.appendChild(opt);
      });

    if (prev) sel.value = prev;

    renderLandingTeams(teams);
  });
}

function renderLandingTeams(teams) {
  const section = document.getElementById('landing-teams-section');
  const list    = document.getElementById('landing-teams-list');
  const entries = Object.keys(teams);

  if (entries.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  const sorted = Object.entries(teams).sort((a, b) => {
    const holeA = Number(a[1].startingHole) || 1;
    const holeB = Number(b[1].startingHole) || 1;
    if (holeA !== holeB) return holeA - holeB;
    const timeA = parseTeeTime(a[1].teeTime);
    const timeB = parseTeeTime(b[1].teeTime);
    if (timeA !== timeB) return timeA - timeB;
    return a[1].name.localeCompare(b[1].name);
  });

  list.innerHTML = '';
  sorted.forEach(([id, team]) => {
    const row = document.createElement('div');
    row.className = 'landing-team-row';

    const leftEl = document.createElement('div');
    leftEl.className = 'landing-team-left';

    const nameEl = document.createElement('div');
    nameEl.className = 'landing-team-name';
    nameEl.textContent = team.name;
    leftEl.appendChild(nameEl);

    const players = (team.players || []).filter(p => p);
    if (players.length) {
      const playersEl = document.createElement('div');
      playersEl.className = 'landing-team-players';
      playersEl.textContent = players.join(', ');
      leftEl.appendChild(playersEl);
    }

    const detailsEl = document.createElement('div');
    detailsEl.className = 'landing-team-details';

    const holeEl = document.createElement('span');
    holeEl.className = 'landing-team-hole';
    holeEl.textContent = `Hole ${team.startingHole || 1}`;
    detailsEl.appendChild(holeEl);

    if (team.teeTime) {
      const timeEl = document.createElement('span');
      timeEl.className = 'landing-team-time';
      timeEl.textContent = team.teeTime;
      detailsEl.appendChild(timeEl);
    }

    row.appendChild(leftEl);
    row.appendChild(detailsEl);
    list.appendChild(row);
  });
}

function parseTeeTime(timeStr) {
  if (!timeStr) return Infinity;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return Infinity;
  let h = Number(match[1]);
  const m = Number(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

// ── Login / PIN check ─────────────────────────────────────────
document.getElementById('login-btn').addEventListener('click', attemptLogin);
document.getElementById('pin-input').addEventListener('keyup', e => {
  if (e.key === 'Enter') attemptLogin();
});

async function attemptLogin() {
  const teamId = document.getElementById('team-select').value;
  const pin    = document.getElementById('pin-input').value.trim();
  const errEl  = document.getElementById('login-error');

  if (!teamId) { errEl.textContent = 'Please select your team.'; return; }
  if (!pin)    { errEl.textContent = 'Please enter your PIN.';   return; }

  const snap = await db.ref(`tournament/teams/${teamId}`).get();
  const team = snap.val();

  if (!team)           { errEl.textContent = 'Team not found.';    return; }
  if (team.pin !== pin) { errEl.textContent = 'Incorrect PIN. Try again.'; return; }

  errEl.textContent  = '';
  currentTeamId      = teamId;
  currentTeamData    = team;
  openScorecard(teamId, team);
}

// ── Scorecard ─────────────────────────────────────────────────
function openScorecard(teamId, team) {
  document.getElementById('sc-team-name').textContent = team.name;

  const players = (team.players || []).filter(p => p);
  document.getElementById('sc-players').textContent = players.join(' • ');

  renderHoleRows(teamId, team);

  // Detach previous listener
  if (scoresListener) {
    db.ref(`tournament/teams/${currentTeamId}/scores`).off('value', scoresListener);
  }

  scoresListener = db.ref(`tournament/teams/${teamId}/scores`).on('value', snap => {
    const scores = snap.val() || {};
    syncInputsToScores(scores);
    updateRunningTotal(scores);
  });

  showView('scorecard');
}

function renderHoleRows(teamId, team) {
  const container = document.getElementById('scorecard-holes');
  container.innerHTML = '';

  for (let h = 1; h <= 18; h++) {
    const isStart = Number(team.startingHole) === h;
    const row = document.createElement('div');
    row.className = `hole-row${isStart ? ' starting-hole' : ''}`;
    row.innerHTML = `
      <div class="hole-left">
        <div class="hole-num-circle">${h}</div>
        <div class="hole-meta">
          <span class="hole-label">Hole ${h}</span>
          ${isStart ? '<span class="start-badge">YOUR START</span>' : ''}
        </div>
      </div>
      <input
        type="number"
        class="hole-score-input"
        id="hole-input-${h}"
        data-hole="${h}"
        min="1"
        max="20"
        placeholder="—"
        inputmode="numeric"
      />
    `;
    container.appendChild(row);

    const input = row.querySelector('input');
    input.addEventListener('change', e => saveScore(teamId, h, e.target.value));
    input.addEventListener('input',  () => updateRunningTotal(getCurrentScoresFromInputs()));
  }
}

function syncInputsToScores(scores) {
  for (let h = 1; h <= 18; h++) {
    const input = document.getElementById(`hole-input-${h}`);
    if (!input || input === document.activeElement) continue;
    const val = scores[`hole${h}`];
    input.value = val != null ? val : '';
    input.classList.toggle('has-score', val != null);
  }
}

function getCurrentScoresFromInputs() {
  const scores = {};
  for (let h = 1; h <= 18; h++) {
    const val = document.getElementById(`hole-input-${h}`)?.value;
    if (val !== '' && val != null) scores[`hole${h}`] = Number(val);
  }
  return scores;
}

function saveScore(teamId, hole, rawVal) {
  const val = parseInt(rawVal, 10);
  const ref = db.ref(`tournament/teams/${teamId}/scores/hole${hole}`);
  if (!isNaN(val) && val >= 1) {
    ref.set(val);
  } else {
    ref.remove();
  }
}

function updateRunningTotal(scores) {
  const total = Object.values(scores).reduce((sum, s) => sum + (Number(s) || 0), 0);
  document.getElementById('running-total').textContent = total || '—';
}

// ── Leaderboard ───────────────────────────────────────────────
function openLeaderboard() {
  if (teamsListener) {
    db.ref('tournament/teams').off('value', teamsListener);
  }

  teamsListener = db.ref('tournament/teams').on('value', snap => {
    const teams = snap.val() || {};
    const rows  = Object.entries(teams).map(([id, team]) => {
      const scores        = team.scores || {};
      const holesScored   = Object.values(scores).filter(s => Number(s) > 0);
      const total         = holesScored.reduce((sum, s) => sum + Number(s), 0);
      const holesComplete = holesScored.length;
      return { id, name: team.name, players: team.players || [], total, holesComplete };
    });

    // Sort: scored teams by total (asc), then un-scored teams alphabetically
    rows.sort((a, b) => {
      if (a.total > 0 && b.total > 0) return a.total - b.total;
      if (a.total > 0) return -1;
      if (b.total > 0) return  1;
      return a.name.localeCompare(b.name);
    });

    renderLeaderboard(rows);
  });

  showView('leaderboard');
}

function renderLeaderboard(rows) {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '';

  if (rows.length === 0) {
    list.innerHTML = '<p class="empty-state">No teams registered yet.</p>';
    return;
  }

  let rank = 1;
  rows.forEach((team, i) => {
    const isLeader     = i === 0 && team.total > 0;
    const isCurrentTeam = team.id === currentTeamId;
    const displayRank  = team.total > 0 ? rank++ : '—';

    const card = document.createElement('div');
    card.className = [
      'leaderboard-card',
      isLeader      ? 'leader'       : '',
      isCurrentTeam ? 'current-team' : '',
    ].join(' ');

    const players = team.players.filter(p => p).join(', ');

    card.innerHTML = `
      <div class="lb-rank">${displayRank}</div>
      <div class="lb-info">
        <div class="lb-team-name">
          ${team.name}
          ${isCurrentTeam ? '<span class="you-badge">YOU</span>' : ''}
        </div>
        ${players ? `<div class="lb-players">${players}</div>` : ''}
        <div class="lb-holes">${team.holesComplete} / 18 holes scored</div>
      </div>
      <div class="lb-score">${team.total || '—'}</div>
    `;
    list.appendChild(card);
  });
}

// ── Navigation ────────────────────────────────────────────────
document.getElementById('leaderboard-btn').addEventListener('click',    openLeaderboard);
document.getElementById('sc-leaderboard-btn').addEventListener('click', openLeaderboard);

document.getElementById('sc-back-btn').addEventListener('click', () => showView('landing'));

document.getElementById('lb-back-btn').addEventListener('click', () => {
  if (currentTeamId) showView('scorecard');
  else               showView('landing');
});

// ── Init ──────────────────────────────────────────────────────
loadSettings();
loadTeams();
