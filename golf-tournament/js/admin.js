// ============================================================
// ADMIN CONFIGURATION
// Change ADMIN_PASSWORD before deploying!
// ============================================================
const ADMIN_PASSWORD = 'CHANGE_THIS_PASSWORD';

// ============================================================
// Par values for each hole 1–18 (index 0 = hole 1).
// Adjust to match your actual course. Default is par 72.
// ============================================================
const PAR = [4,4,3,4,5,3,4,4,5, 4,3,4,5,4,3,5,4,4];

// ---- Populate starting hole dropdown ----
(function buildHoleSelect() {
  const sel = document.getElementById('starting-hole');
  for (let i = 1; i <= 18; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Hole ${i}`;
    sel.appendChild(opt);
  }
})();

// ============================================================
// LOGIN / LOGOUT
// ============================================================
function doLogin() {
  const pw = document.getElementById('admin-password').value;
  if (pw === ADMIN_PASSWORD) {
    sessionStorage.setItem('adminLoggedIn', 'true');
    showAdminPanel();
  } else {
    showAlert('login-error', 'Incorrect password. Please try again.', 'error');
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-password').focus();
  }
}

function doLogout() {
  sessionStorage.removeItem('adminLoggedIn');
  location.reload();
}

function showAdminPanel() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('admin-panel').classList.remove('hidden');
  loadTournamentSettings();
  listenToTeams();
}

// Allow Enter key on password field
document.getElementById('admin-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

// Auto-restore session
if (sessionStorage.getItem('adminLoggedIn') === 'true') {
  showAdminPanel();
}

// ============================================================
// TOURNAMENT SETTINGS
// ============================================================
function loadTournamentSettings() {
  db.ref('tournament').once('value').then(snap => {
    const d = snap.val();
    if (!d) return;
    document.getElementById('tourney-name').value         = d.name         || '';
    document.getElementById('tourney-date').value         = d.date         || '';
    document.getElementById('tourney-format').value       = d.format       || 'Scramble';
    document.getElementById('tourney-instructions').value = d.instructions || '';
  });
}

function saveTournament() {
  const name         = document.getElementById('tourney-name').value.trim();
  const date         = document.getElementById('tourney-date').value;
  const format       = document.getElementById('tourney-format').value.trim();
  const instructions = document.getElementById('tourney-instructions').value.trim();

  if (!name) {
    showAlert('settings-alert', 'Tournament name is required.', 'error');
    return;
  }

  db.ref('tournament').set({ name, date, format, instructions })
    .then(() => showAlert('settings-alert', '✓ Tournament info saved!', 'success'))
    .catch(err => showAlert('settings-alert', 'Error saving: ' + err.message, 'error'));
}

// ============================================================
// TEAMS — LISTEN & RENDER
// ============================================================
let editingTeamId = null;

function listenToTeams() {
  db.ref('teams').on('value', snap => {
    const data = snap.val();
    const count = data ? Object.keys(data).length : 0;
    document.getElementById('team-count').textContent = count;
    renderTeams(data);
  });
}

function renderTeams(data) {
  const container = document.getElementById('teams-list');
  if (!data) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">👥</div>
        <p>No teams added yet. Use the form above to add your first team.</p>
      </div>`;
    return;
  }

  const sorted = Object.entries(data).sort((a, b) => {
    const ta = a[1].teeTime || '99:99';
    const tb = b[1].teeTime || '99:99';
    return ta.localeCompare(tb);
  });

  container.innerHTML = sorted.map(([id, team]) => `
    <div class="team-card">
      <div class="team-card-info" style="flex:1;min-width:0;">
        <h3>${esc(team.name)}</h3>
        <div class="meta">
          <span class="tee-badge">⛳ Hole ${team.startingHole || 1}</span>
          ${team.teeTime ? `<span class="tee-badge">🕐 ${fmtTime(team.teeTime)}</span>` : ''}
          <span class="tee-badge">🔒 PIN: ${esc(team.pin)}</span>
        </div>
        <div class="team-players-small" style="margin-top:0.4rem;">
          ${(team.players || []).map(p => esc(p)).join(' &middot; ')}
        </div>
      </div>
      <div class="team-card-actions">
        <button class="btn btn-ghost btn-sm" onclick="editTeam('${id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTeam('${id}', '${esc(team.name)}')">Delete</button>
      </div>
    </div>
  `).join('');
}

// ============================================================
// ADD / EDIT TEAM
// ============================================================
function saveTeam() {
  const name         = document.getElementById('team-name').value.trim();
  const pin          = document.getElementById('team-pin').value.trim();
  const startingHole = parseInt(document.getElementById('starting-hole').value) || 1;
  const teeTime      = document.getElementById('tee-time').value;
  const players = [
    document.getElementById('player-1').value.trim(),
    document.getElementById('player-2').value.trim(),
    document.getElementById('player-3').value.trim(),
    document.getElementById('player-4').value.trim(),
  ];

  // Validation
  if (!name) {
    showAlert('team-alert', 'Team name is required.', 'error'); return;
  }
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    showAlert('team-alert', 'PIN must be 4–6 digits.', 'error'); return;
  }
  if (players.some(p => !p)) {
    showAlert('team-alert', 'All 4 player names are required.', 'error'); return;
  }

  const teamData = { name, pin, players, startingHole, teeTime };

  const operation = editingTeamId
    ? db.ref(`teams/${editingTeamId}`).update(teamData)
    : db.ref('teams').push(teamData);

  operation
    .then(() => {
      showAlert('team-alert', editingTeamId ? '✓ Team updated!' : '✓ Team added!', 'success');
      resetTeamForm();
    })
    .catch(err => showAlert('team-alert', 'Error: ' + err.message, 'error'));
}

function editTeam(id) {
  db.ref(`teams/${id}`).once('value').then(snap => {
    const t = snap.val();
    if (!t) return;

    editingTeamId = id;
    document.getElementById('team-form-title').textContent = 'Edit Team';
    document.getElementById('cancel-edit-btn').style.display = '';

    document.getElementById('team-name').value    = t.name || '';
    document.getElementById('team-pin').value     = t.pin  || '';
    document.getElementById('player-1').value     = (t.players || [])[0] || '';
    document.getElementById('player-2').value     = (t.players || [])[1] || '';
    document.getElementById('player-3').value     = (t.players || [])[2] || '';
    document.getElementById('player-4').value     = (t.players || [])[3] || '';
    document.getElementById('starting-hole').value = t.startingHole || 1;
    document.getElementById('tee-time').value     = t.teeTime || '';

    // Scroll form into view
    document.getElementById('team-form-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function cancelEdit() {
  resetTeamForm();
}

function resetTeamForm() {
  editingTeamId = null;
  document.getElementById('team-form-title').textContent = 'Add Team';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  ['team-name','team-pin','player-1','player-2','player-3','player-4','tee-time'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('starting-hole').value = 1;
}

function deleteTeam(id, name) {
  if (!confirm(`Delete team "${name}" and all their scores? This cannot be undone.`)) return;
  Promise.all([
    db.ref(`teams/${id}`).remove(),
    db.ref(`scores/${id}`).remove(),
  ]).catch(err => alert('Error deleting team: ' + err.message));
}

// ============================================================
// UTILITIES
// ============================================================
function showAlert(containerId, message, type) {
  const el = document.getElementById(containerId);
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// Safe HTML escape
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}

// Format HH:MM → 12h AM/PM
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}
