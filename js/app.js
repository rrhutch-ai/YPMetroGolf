// ============================================================
// PLAYER APP — app.js
// ============================================================

let currentTeamId   = null;
let currentTeamData = null;
let scoresListener  = null;
let teamsListener   = null;
let isViewOnly      = true;
let currentPar      = {};
let isLocked        = false;
let scorecardOrigin = 'landing';
let allTeams        = {};

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
      const [y, m, d] = s.date.split('-');
      dateEl.textContent = new Date(Number(y), Number(m) - 1, Number(d))
        .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } else {
      dateEl.textContent = '';
    }

    const instrEl = document.getElementById('t-instructions');
    if (s.instructions) {
      instrEl.innerHTML = s.instructions
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
      instrEl.style.display = 'block';
    } else {
      instrEl.style.display = 'none';
    }

    currentPar = s.par    || {};
    isLocked   = s.locked || false;

    // Re-render landing teams with updated par/progress
    if (Object.keys(allTeams).length) renderLandingTeams(allTeams);

    // Update scorecard live if open
    if (!document.getElementById('scorecard-view').classList.contains('hidden')) {
      updateScorecardBanners();
      updateHoleInputLockState();
    }
  });
}

// ── Team list ─────────────────────────────────────────────────
function loadTeams() {
  db.ref('tournament/teams').on('value', snap => {
    allTeams = snap.val() || {};
    renderLandingTeams(allTeams);
  });
}

function renderLandingTeams(teams) {
  const section = document.getElementById('landing-teams-section');
  const list    = document.getElementById('landing-teams-list');
  const entries = Object.keys(teams);

  if (entries.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';

  const sorted = Object.entries(teams).sort((a, b) => {
    const holeA = parseInt(a[1].startingHole, 10) || 1;
    const holeB = parseInt(b[1].startingHole, 10) || 1;
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

    const players = Object.values(team.players || {}).filter(p => p);
    if (players.length) {
      const playersEl = document.createElement('div');
      playersEl.className = 'landing-team-players';
      playersEl.textContent = players.join(', ');
      leftEl.appendChild(playersEl);
    }

    // Score progress
    const scores    = team.scores || {};
    const scoredKeys = Object.keys(scores).filter(k => Number(scores[k]) > 0);
    if (scoredKeys.length > 0) {
      const total      = scoredKeys.reduce((sum, k) => sum + Number(scores[k]), 0);
      const parTotal   = scoredKeys.reduce((sum, k) => sum + (currentPar[k] || 0), 0);
      const progressEl = document.createElement('div');
      progressEl.className = 'landing-team-progress';
      if (parTotal > 0) {
        const rel    = total - parTotal;
        const relStr = rel === 0 ? 'E' : (rel > 0 ? `+${rel}` : `${rel}`);
        const cls    = rel < 0 ? 'prog-under' : rel > 0 ? 'prog-over' : 'prog-even';
        progressEl.innerHTML = `${scoredKeys.length}/18 &nbsp;•&nbsp; <span class="${cls}">${relStr}</span>`;
      } else {
        progressEl.textContent = `${scoredKeys.length}/18 holes • ${total} strokes`;
      }
      leftEl.appendChild(progressEl);
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

    row.addEventListener('click', () => {
      let authedId = null;
      try { authedId = JSON.parse(sessionStorage.getItem('golfAuthedTeam'))?.id; } catch(e) {}

      currentTeamId   = id;
      currentTeamData = team;
      isViewOnly      = isLocked ? true : (authedId !== id);
      scorecardOrigin = 'landing';
      openScorecard(id, team);
    });

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

// ── PIN modal ─────────────────────────────────────────────────
let pendingTeamId = null;
let pendingTeam   = null;

function openPinModal(teamId, team) {
  pendingTeamId = teamId;
  pendingTeam   = team;
  document.getElementById('pin-modal-team-name').textContent = team.name;
  document.getElementById('pin-modal-input').value           = '';
  document.getElementById('pin-modal-error').textContent     = '';
  document.getElementById('pin-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('pin-modal-input').focus(), 50);
}

function submitPin() {
  const pin   = document.getElementById('pin-modal-input').value.trim();
  const errEl = document.getElementById('pin-modal-error');
  if (!pin)                    { errEl.textContent = 'Please enter your PIN.';    return; }
  if (pendingTeam.pin !== pin) { errEl.textContent = 'Incorrect PIN. Try again.'; return; }
  document.getElementById('pin-modal').classList.add('hidden');
  currentTeamId   = pendingTeamId;
  currentTeamData = pendingTeam;
  isViewOnly      = false;
  sessionStorage.setItem('golfAuthedTeam', JSON.stringify({ id: pendingTeamId }));
  openScorecard(pendingTeamId, pendingTeam);
}

document.getElementById('pin-modal-submit')?.addEventListener('click', submitPin);
document.getElementById('pin-modal-input')?.addEventListener('keyup', e => {
  if (e.key === 'Enter') submitPin();
});
document.getElementById('pin-modal-cancel')?.addEventListener('click', () => {
  document.getElementById('pin-modal').classList.add('hidden');
});
document.getElementById('pin-modal')?.addEventListener('click', e => {
  if (e.target === document.getElementById('pin-modal'))
    document.getElementById('pin-modal').classList.add('hidden');
});

// ── Scorecard ─────────────────────────────────────────────────
function openScorecard(teamId, team) {
  document.getElementById('sc-team-name').textContent = team.name;
  const players = Object.values(team.players || {}).filter(p => p);
  document.getElementById('sc-players').textContent = players.join(' • ');

  updateScorecardBanners();
  renderHoleRows(teamId, team);

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

function updateScorecardBanners() {
  const pinBtn     = document.getElementById('sc-pin-btn');
  const viewBanner = document.getElementById('view-only-banner');
  const lockBanner = document.getElementById('locked-banner');

  if (isLocked) {
    pinBtn.classList.add('hidden');
    viewBanner.classList.add('hidden');
    lockBanner.classList.remove('hidden');
  } else if (isViewOnly) {
    pinBtn.classList.remove('hidden');
    viewBanner.classList.remove('hidden');
    lockBanner.classList.add('hidden');
  } else {
    pinBtn.classList.add('hidden');
    viewBanner.classList.add('hidden');
    lockBanner.classList.add('hidden');
  }
}

function updateHoleInputLockState() {
  const shouldDisable = isViewOnly || isLocked;
  for (let h = 1; h <= 18; h++) {
    const input = document.getElementById(`hole-input-${h}`);
    if (input) input.disabled = shouldDisable;
  }
}

function renderHoleRows(teamId, team) {
  const container     = document.getElementById('scorecard-holes');
  container.innerHTML = '';
  const shouldDisable = isViewOnly || isLocked;

  for (let h = 1; h <= 18; h++) {
    const isStart = Number(team.startingHole) === h;
    const par     = currentPar[`hole${h}`];
    const row     = document.createElement('div');
    row.className = `hole-row${isStart ? ' starting-hole' : ''}`;
    row.innerHTML = `
      <div class="hole-left">
        <div class="hole-num-circle">${h}</div>
        <div class="hole-meta">
          <span class="hole-label">Hole ${h}</span>
          ${par ? `<span class="hole-par">Par ${par}</span>` : ''}
          ${isStart ? '<span class="start-badge">YOUR START</span>' : ''}
        </div>
      </div>
      <input
        type="number"
        class="hole-score-input"
        id="hole-input-${h}"
        data-hole="${h}"
        min="1" max="20"
        placeholder="—"
        inputmode="numeric"
        ${shouldDisable ? 'disabled' : ''}
      />
    `;
    container.appendChild(row);

    if (!shouldDisable) {
      const input = row.querySelector('input');
      input.addEventListener('change', e => saveScore(teamId, h, e.target.value, input));
      input.addEventListener('input',  () => updateRunningTotal(getCurrentScoresFromInputs()));
    }
  }
}

function syncInputsToScores(scores) {
  for (let h = 1; h <= 18; h++) {
    const input = document.getElementById(`hole-input-${h}`);
    if (!input || input === document.activeElement) continue;
    const val = scores[`hole${h}`];
    input.value = val != null ? val : '';
    input.classList.toggle('has-score', val != null);
    applyScoreClass(input, val, h);
  }
}

function applyScoreClass(input, score, holeNum) {
  input.classList.remove('score-eagle', 'score-birdie', 'score-par', 'score-bogey', 'score-double');
  const par = currentPar[`hole${holeNum}`];
  if (!score || !par) return;
  const diff = Number(score) - par;
  if (diff <= -2)       input.classList.add('score-eagle');
  else if (diff === -1) input.classList.add('score-birdie');
  else if (diff === 0)  input.classList.add('score-par');
  else if (diff === 1)  input.classList.add('score-bogey');
  else                  input.classList.add('score-double');
}

function getCurrentScoresFromInputs() {
  const scores = {};
  for (let h = 1; h <= 18; h++) {
    const val = document.getElementById(`hole-input-${h}`)?.value;
    if (val !== '' && val != null) scores[`hole${h}`] = Number(val);
  }
  return scores;
}

function saveScore(teamId, hole, rawVal, input) {
  const val = parseInt(rawVal, 10);
  const ref = db.ref(`tournament/teams/${teamId}/scores/hole${hole}`);
  if (!isNaN(val) && val >= 1) {
    ref.set(val).then(() => {
      flashSaved(input);
      applyScoreClass(input, val, hole);
    });
  } else {
    ref.remove().then(() => {
      input.classList.remove('score-eagle', 'score-birdie', 'score-par', 'score-bogey', 'score-double');
    });
  }
}

function flashSaved(input) {
  input.classList.remove('score-saved-flash');
  void input.offsetWidth;
  input.classList.add('score-saved-flash');
  setTimeout(() => input.classList.remove('score-saved-flash'), 1200);
}

function updateRunningTotal(scores) {
  const scoredKeys   = Object.keys(scores).filter(k => Number(scores[k]) > 0);
  const total        = scoredKeys.reduce((sum, k) => sum + Number(scores[k]), 0);
  const parForScored = scoredKeys.reduce((sum, k) => sum + (currentPar[k] || 0), 0);

  const totalEl = document.getElementById('running-total');
  const relEl   = document.getElementById('running-rel');

  if (total === 0) {
    totalEl.textContent = '—';
    if (relEl) { relEl.textContent = ''; relEl.className = 'running-rel'; }
  } else {
    totalEl.textContent = total;
    if (relEl && parForScored > 0) {
      const rel = total - parForScored;
      relEl.textContent = rel === 0 ? 'E' : (rel > 0 ? `+${rel}` : `${rel}`);
      relEl.className   = `running-rel ${rel < 0 ? 'under-par' : rel > 0 ? 'over-par' : 'even-par'}`;
    } else if (relEl) {
      relEl.textContent = '';
      relEl.className   = 'running-rel';
    }
  }
}

// ── Leaderboard ───────────────────────────────────────────────
function openLeaderboard() {
  if (teamsListener) db.ref('tournament/teams').off('value', teamsListener);

  teamsListener = db.ref('tournament/teams').on('value', snap => {
    allTeams = snap.val() || {};
    const hasPar = Object.keys(currentPar).length > 0;

    const rows = Object.entries(allTeams).map(([id, team]) => {
      const scores        = team.scores || {};
      const scoredKeys    = Object.keys(scores).filter(k => Number(scores[k]) > 0);
      const total         = scoredKeys.reduce((sum, k) => sum + Number(scores[k]), 0);
      const holesComplete = scoredKeys.length;
      const isComplete    = holesComplete === 18;
      const parForScored  = scoredKeys.reduce((sum, k) => sum + (currentPar[k] || 0), 0);
      const relScore      = (hasPar && parForScored > 0) ? total - parForScored : null;
      const players       = Object.values(team.players || {});
      return { id, name: team.name, players, total, holesComplete, isComplete, relScore };
    });

    rows.sort((a, b) => {
      const aStarted = a.total > 0;
      const bStarted = b.total > 0;
      if (aStarted && bStarted) {
        if (a.relScore !== null && b.relScore !== null) return a.relScore - b.relScore;
        return a.total - b.total;
      }
      if (aStarted) return -1;
      if (bStarted) return  1;
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

  const hasPar = Object.keys(currentPar).length > 0;
  let rank = 1;

  rows.forEach((team, i) => {
    const isLeader      = i === 0 && team.total > 0;
    const isCurrentTeam = team.id === currentTeamId;
    const displayRank   = team.total > 0 ? rank++ : '—';

    let scoreMainHtml = '<span class="lb-score-main">—</span>';
    let scoreSubHtml  = '';

    if (team.total > 0) {
      if (hasPar && team.relScore !== null) {
        const relStr  = team.relScore === 0 ? 'E' : (team.relScore > 0 ? `+${team.relScore}` : `${team.relScore}`);
        const relCls  = team.relScore < 0 ? 'under-par' : team.relScore > 0 ? 'over-par' : 'even-par';
        scoreMainHtml = `<span class="lb-score-main ${relCls}">${relStr}</span>`;
        scoreSubHtml  = `<span class="lb-score-sub">${team.total} strokes</span>`;
      } else {
        scoreMainHtml = `<span class="lb-score-main">${team.total}</span>`;
      }
    }

    const card = document.createElement('div');
    card.className = [
      'leaderboard-card clickable',
      isLeader      ? 'leader'       : '',
      isCurrentTeam ? 'current-team' : '',
    ].filter(Boolean).join(' ');

    const players = team.players.filter(p => p).join(', ');
    card.innerHTML = `
      <div class="lb-rank">${displayRank}</div>
      <div class="lb-info">
        <div class="lb-team-name">
          ${team.name}
          ${isCurrentTeam ? '<span class="you-badge">YOU</span>' : ''}
          ${team.isComplete ? '<span class="done-badge">✓ DONE</span>' : ''}
        </div>
        ${players ? `<div class="lb-players">${players}</div>` : ''}
        <div class="lb-holes">${team.holesComplete} / 18 holes scored</div>
      </div>
      <div class="lb-score">${scoreMainHtml}${scoreSubHtml}</div>
    `;

    card.addEventListener('click', () => {
      const teamFull = allTeams[team.id];
      if (!teamFull) return;
      currentTeamId   = team.id;
      currentTeamData = teamFull;
      isViewOnly      = true;
      scorecardOrigin = 'leaderboard';
      openScorecard(team.id, teamFull);
    });

    list.appendChild(card);
  });
}

// ── Navigation ────────────────────────────────────────────────
document.getElementById('leaderboard-btn')?.addEventListener('click',    openLeaderboard);
document.getElementById('sc-leaderboard-btn')?.addEventListener('click', openLeaderboard);

document.getElementById('sc-pin-btn')?.addEventListener('click', () => {
  openPinModal(currentTeamId, currentTeamData);
});

document.getElementById('sc-back-btn')?.addEventListener('click', () => {
  showView(scorecardOrigin);
});

document.getElementById('lb-back-btn')?.addEventListener('click', () => {
  if (currentTeamId && !isViewOnly && !isLocked) showView('scorecard');
  else showView('landing');
});

// ── Init ──────────────────────────────────────────────────────
loadSettings();
loadTeams();
