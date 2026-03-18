// ============================================================
// ADMIN PORTAL — admin.js
// ============================================================

// Change this password to whatever you want.
// For production, replace with proper Firebase Authentication.
const ADMIN_PASSWORD = 'golf2024';

let editingTeamId = null;
let teamsCache    = {};

// ── Login ─────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', e => {
  e.preventDefault();
  const pw = document.getElementById('admin-password').value;
  if (pw === ADMIN_PASSWORD) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('admin-view').classList.remove('hidden');
    initAdminData();
  } else {
    document.getElementById('login-error').textContent = 'Incorrect password.';
  }
});

// ── Data loaders ──────────────────────────────────────────────
function initAdminData() {
  // Tournament settings
  db.ref('tournament/settings').on('value', snap => {
    const s = snap.val() || {};
    document.getElementById('t-name-input').value         = s.name         || '';
    document.getElementById('t-date-input').value         = s.date         || '';
    document.getElementById('t-instructions-input').value = s.instructions || '';
  });

  // Teams
  db.ref('tournament/teams').on('value', snap => {
    teamsCache = snap.val() || {};
    renderTeamsList(teamsCache);
    const count = Object.keys(teamsCache).length;
    document.getElementById('teams-count').textContent =
      count === 0 ? '' : `${count} team${count !== 1 ? 's' : ''}`;
  });
}

// ── Tournament settings form ──────────────────────────────────
document.getElementById('settings-form').addEventListener('submit', e => {
  e.preventDefault();
  const settings = {
    name:         document.getElementById('t-name-input').value.trim(),
    date:         document.getElementById('t-date-input').value,
    instructions: document.getElementById('t-instructions-input').value.trim(),
  };
  db.ref('tournament/settings').set(settings)
    .then(() => showAlert('Settings saved!', 'success'))
    .catch(err => showAlert('Error saving settings: ' + err.message, 'error'));
});

// ── Team form ─────────────────────────────────────────────────
document.getElementById('team-form').addEventListener('submit', e => {
  e.preventDefault();

  const name = document.getElementById('f-team-name').value.trim();
  const p1   = document.getElementById('f-p1').value.trim();
  const pin  = document.getElementById('f-pin').value.trim();

  if (!name) { showAlert('Team name is required.', 'error'); return; }
  if (!p1)   { showAlert('At least one player name is required.', 'error'); return; }
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    showAlert('PIN must be 4–6 digits.', 'error');
    return;
  }

  // Format tee time for display
  const rawTime = document.getElementById('f-tee-time').value;
  let teeTime = '';
  if (rawTime) {
    const [h, m] = rawTime.split(':').map(Number);
    const ampm   = h >= 12 ? 'PM' : 'AM';
    const hour   = h % 12 || 12;
    teeTime      = `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  const teamData = {
    name,
    players: [
      p1,
      document.getElementById('f-p2').value.trim(),
      document.getElementById('f-p3').value.trim(),
      document.getElementById('f-p4').value.trim(),
    ],
    pin,
    startingHole: Number(document.getElementById('f-starting-hole').value) || 1,
    teeTime,
  };

  if (editingTeamId) {
    // Preserve existing scores on edit
    if (teamsCache[editingTeamId]?.scores) {
      teamData.scores = teamsCache[editingTeamId].scores;
    }
    db.ref(`tournament/teams/${editingTeamId}`).set(teamData)
      .then(() => { showAlert('Team updated!', 'success'); resetTeamForm(); })
      .catch(err => showAlert('Error: ' + err.message, 'error'));
  } else {
    db.ref('tournament/teams').push(teamData)
      .then(() => { showAlert('Team added!', 'success'); resetTeamForm(); })
      .catch(err => showAlert('Error: ' + err.message, 'error'));
  }
});

document.getElementById('cancel-edit-btn').addEventListener('click', resetTeamForm);

function resetTeamForm() {
  editingTeamId = null;
  document.getElementById('team-form').reset();
  document.getElementById('team-form-title').textContent = '➕ Add Team';
  document.getElementById('team-submit-btn').textContent  = 'Add Team';
  document.getElementById('cancel-edit-btn').classList.add('hidden');
}

// ── Teams list rendering ──────────────────────────────────────
function renderTeamsList(teams) {
  const list = document.getElementById('teams-list');

  if (Object.keys(teams).length === 0) {
    list.innerHTML = '<p class="empty-state">No teams yet. Add one above.</p>';
    return;
  }

  // Sort alphabetically by name
  const sorted = Object.entries(teams).sort((a, b) => a[1].name.localeCompare(b[1].name));

  list.innerHTML = '';
  sorted.forEach(([id, team]) => {
    const scores        = team.scores || {};
    const holesScored   = Object.values(scores).filter(s => Number(s) > 0);
    const total         = holesScored.reduce((sum, s) => sum + Number(s), 0);
    const holesComplete = holesScored.length;
    const players       = (team.players || []).filter(p => p);

    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
      <div class="team-card-info">
        <div class="team-card-name">${escHtml(team.name)}</div>
        <div class="team-card-meta">
          Hole ${team.startingHole || 1}
          ${team.teeTime ? ' &bull; ' + escHtml(team.teeTime) : ''}
          &bull; PIN: ${escHtml(team.pin)}
        </div>
        ${players.length ? `<div class="team-card-players">${players.map(escHtml).join(', ')}</div>` : ''}
        <div class="team-card-score">
          ${holesComplete}/18 holes &nbsp;|&nbsp; Total: ${total || '—'}
        </div>
      </div>
      <div class="team-card-actions">
        <button class="btn-edit"   data-id="${id}">Edit</button>
        <button class="btn-delete" data-id="${id}" data-name="${escHtml(team.name)}">Delete</button>
      </div>
    `;
    list.appendChild(card);
  });

  // Event delegation for edit/delete buttons
  list.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => editTeam(btn.dataset.id));
  });
  list.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTeam(btn.dataset.id, btn.dataset.name));
  });
}

// ── Edit team ─────────────────────────────────────────────────
function editTeam(id) {
  const team = teamsCache[id];
  if (!team) return;

  editingTeamId = id;

  document.getElementById('f-team-name').value     = team.name            || '';
  document.getElementById('f-p1').value             = team.players?.[0]   || '';
  document.getElementById('f-p2').value             = team.players?.[1]   || '';
  document.getElementById('f-p3').value             = team.players?.[2]   || '';
  document.getElementById('f-p4').value             = team.players?.[3]   || '';
  document.getElementById('f-pin').value            = team.pin            || '';
  document.getElementById('f-starting-hole').value  = team.startingHole   || 1;

  // Convert stored "8:30 AM" back to HH:MM for time input
  if (team.teeTime) {
    const match = team.teeTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      let h = Number(match[1]);
      const m = match[2];
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h  = 0;
      document.getElementById('f-tee-time').value = `${String(h).padStart(2,'0')}:${m}`;
    }
  } else {
    document.getElementById('f-tee-time').value = '';
  }

  document.getElementById('team-form-title').textContent = '✏️ Edit Team';
  document.getElementById('team-submit-btn').textContent  = 'Update Team';
  document.getElementById('cancel-edit-btn').classList.remove('hidden');

  document.getElementById('team-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Delete team ───────────────────────────────────────────────
function deleteTeam(id, name) {
  if (!confirm(`Delete team "${name}"?\n\nThis will permanently remove the team and all their scores.`)) return;
  db.ref(`tournament/teams/${id}`).remove()
    .then(() => showAlert(`Team "${name}" deleted.`, 'success'))
    .catch(err => showAlert('Error deleting team: ' + err.message, 'error'));
}

// ── Helpers ───────────────────────────────────────────────────
function showAlert(msg, type) {
  const el = document.getElementById('admin-alert');
  el.textContent  = msg;
  el.className    = `alert alert-${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
