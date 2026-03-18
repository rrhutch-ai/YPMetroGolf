// ============================================================
// ADMIN PORTAL — admin.js
// ============================================================

const ADMIN_PASSWORD = 'golf2024';

let editingTeamId  = null;
let teamsCache     = {};
let overrideTeamId = null;

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
  db.ref('tournament/settings').on('value', snap => {
    const s = snap.val() || {};
    document.getElementById('t-name-input').value         = s.name         || '';
    document.getElementById('t-date-input').value         = s.date         || '';
    document.getElementById('t-instructions-input').value = s.instructions || '';
    document.getElementById('t-locked-input').checked     = s.locked       || false;
    renderParGrid(s.par || {});
  });

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
  const updates = {
    'tournament/settings/name':         document.getElementById('t-name-input').value.trim(),
    'tournament/settings/date':         document.getElementById('t-date-input').value,
    'tournament/settings/instructions': document.getElementById('t-instructions-input').value.trim(),
    'tournament/settings/locked':       document.getElementById('t-locked-input').checked,
  };
  db.ref().update(updates)
    .then(() => showAlert('Settings saved!', 'success'))
    .catch(err => showAlert('Error saving settings: ' + err.message, 'error'));
});

// ── Par settings ──────────────────────────────────────────────
function renderParGrid(parData) {
  const front = document.getElementById('par-grid-front');
  const back  = document.getElementById('par-grid-back');
  if (!front || !back) return;
  front.innerHTML = '';
  back.innerHTML  = '';

  for (let h = 1; h <= 18; h++) {
    const par = parData[`hole${h}`] || 4;
    const div = document.createElement('div');
    div.className = 'par-hole-cell';
    div.innerHTML = `
      <span class="par-hole-label">H${h}</span>
      <input type="number" class="par-hole-input" id="par-hole-${h}"
             value="${par}" min="3" max="5" />
    `;
    if (h <= 9) front.appendChild(div);
    else        back.appendChild(div);
  }
}

function getParFromInputs() {
  const par = {};
  for (let h = 1; h <= 18; h++) {
    const val = parseInt(document.getElementById(`par-hole-${h}`)?.value, 10);
    par[`hole${h}`] = (val >= 3 && val <= 5) ? val : 4;
  }
  return par;
}

document.getElementById('save-par-btn')?.addEventListener('click', () => {
  const par = getParFromInputs();
  db.ref('tournament/settings/par').set(par)
    .then(() => showAlert('Par settings saved!', 'success'))
    .catch(err => showAlert('Error: ' + err.message, 'error'));
});

document.getElementById('reset-par-btn')?.addEventListener('click', () => {
  for (let h = 1; h <= 18; h++) {
    const input = document.getElementById(`par-hole-${h}`);
    if (input) input.value = 4;
  }
});

// ── Team form ─────────────────────────────────────────────────
document.getElementById('team-form').addEventListener('submit', e => {
  e.preventDefault();

  const name = document.getElementById('f-team-name').value.trim();
  const p1   = document.getElementById('f-p1').value.trim();
  const pin  = document.getElementById('f-pin').value.trim();

  if (!name) { showAlert('Team name is required.', 'error'); return; }
  if (!p1)   { showAlert('At least one player name is required.', 'error'); return; }
  if (!pin || !/^\d{4,6}$/.test(pin)) { showAlert('PIN must be 4–6 digits.', 'error'); return; }

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
    if (teamsCache[editingTeamId]?.scores) teamData.scores = teamsCache[editingTeamId].scores;
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

  const sorted = Object.entries(teams).sort((a, b) => a[1].name.localeCompare(b[1].name));

  list.innerHTML = '';
  sorted.forEach(([id, team]) => {
    const scores        = team.scores || {};
    const holesScored   = Object.values(scores).filter(s => Number(s) > 0);
    const total         = holesScored.reduce((sum, s) => sum + Number(s), 0);
    const holesComplete = holesScored.length;
    const players       = (team.players || []).filter(p => p);
    const isComplete    = holesComplete === 18;

    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
      <div class="team-card-info">
        <div class="team-card-name">
          ${escHtml(team.name)}
          ${isComplete ? '<span class="done-badge">✓ DONE</span>' : ''}
        </div>
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
        <button class="btn-scores" data-id="${id}">Scores</button>
        <button class="btn-edit"   data-id="${id}">Edit</button>
        <button class="btn-delete" data-id="${id}" data-name="${escHtml(team.name)}">Delete</button>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.btn-scores').forEach(btn => {
    btn.addEventListener('click', () => openScoreOverride(btn.dataset.id));
  });
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
  document.getElementById('f-team-name').value    = team.name           || '';
  document.getElementById('f-p1').value            = team.players?.[0]  || '';
  document.getElementById('f-p2').value            = team.players?.[1]  || '';
  document.getElementById('f-p3').value            = team.players?.[2]  || '';
  document.getElementById('f-p4').value            = team.players?.[3]  || '';
  document.getElementById('f-pin').value           = team.pin           || '';
  document.getElementById('f-starting-hole').value = team.startingHole  || 1;

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

// ── Score override ────────────────────────────────────────────
function openScoreOverride(teamId) {
  const team = teamsCache[teamId];
  if (!team) return;
  overrideTeamId = teamId;

  document.getElementById('override-team-name').textContent = team.name;

  const front = document.getElementById('override-grid-front');
  const back  = document.getElementById('override-grid-back');
  front.innerHTML = '';
  back.innerHTML  = '';

  for (let h = 1; h <= 18; h++) {
    const score = team.scores?.[`hole${h}`] ?? '';
    const div   = document.createElement('div');
    div.className = 'par-hole-cell';
    div.innerHTML = `
      <span class="par-hole-label">H${h}</span>
      <input type="number" class="par-hole-input" id="override-hole-${h}"
             value="${score}" min="1" max="20" placeholder="—" />
    `;
    if (h <= 9) front.appendChild(div);
    else        back.appendChild(div);
  }

  document.getElementById('score-override-modal').classList.remove('hidden');
}

document.getElementById('override-save-btn')?.addEventListener('click', async () => {
  if (!overrideTeamId) return;
  const scores = {};
  for (let h = 1; h <= 18; h++) {
    const val = parseInt(document.getElementById(`override-hole-${h}`)?.value, 10);
    if (!isNaN(val) && val >= 1) scores[`hole${h}`] = val;
  }
  try {
    await db.ref(`tournament/teams/${overrideTeamId}/scores`).set(
      Object.keys(scores).length ? scores : null
    );
    document.getElementById('score-override-modal').classList.add('hidden');
    showAlert('Scores updated!', 'success');
  } catch (err) {
    showAlert('Error: ' + err.message, 'error');
  }
});

document.getElementById('override-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('score-override-modal').classList.add('hidden');
});

document.getElementById('score-override-modal')?.addEventListener('click', e => {
  if (e.target === document.getElementById('score-override-modal'))
    document.getElementById('score-override-modal').classList.add('hidden');
});

// ── CSV Import ────────────────────────────────────────────────
let csvParsedTeams = [];

const csvDropArea       = document.getElementById('csv-drop-area');
const csvFileInput      = document.getElementById('csv-file-input');
const csvPreview        = document.getElementById('csv-preview');
const csvPreviewContent = document.getElementById('csv-preview-content');
const csvImportBtn      = document.getElementById('csv-import-btn');
const csvCancelBtn      = document.getElementById('csv-cancel-btn');

csvDropArea.addEventListener('click', () => csvFileInput.click());
csvDropArea.addEventListener('dragover', e => { e.preventDefault(); csvDropArea.style.borderColor = 'var(--teal)'; });
csvDropArea.addEventListener('dragleave', () => { csvDropArea.style.borderColor = ''; });
csvDropArea.addEventListener('drop', e => {
  e.preventDefault(); csvDropArea.style.borderColor = '';
  const file = e.dataTransfer.files[0]; if (file) handleCsvFile(file);
});
csvFileInput.addEventListener('change', e => { const file = e.target.files[0]; if (file) handleCsvFile(file); });

function handleCsvFile(file) {
  const reader = new FileReader();
  reader.onload = e => { csvParsedTeams = parseCsv(e.target.result); renderCsvPreview(csvParsedTeams); };
  reader.readAsText(file);
}

function parseCsvLine(line) {
  const result = []; let current = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += c; }
  }
  result.push(current);
  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  let startIdx = 0;
  const firstCol = (parseCsvLine(lines[0])[0] || '').toLowerCase();
  if (firstCol === 'team name' || firstCol === 'team' || firstCol === 'name') startIdx = 1;

  return lines.slice(startIdx).map(line => {
    const cols      = parseCsvLine(line);
    const name      = (cols[0] || '').trim();
    const p1        = (cols[1] || '').trim();
    const p2        = (cols[2] || '').trim();
    const p3        = (cols[3] || '').trim();
    const p4        = (cols[4] || '').trim();
    const pin       = (cols[5] || '').trim();
    const startHole = Math.min(18, Math.max(1, parseInt(cols[6] || '1', 10) || 1));
    const rawTime   = (cols[7] || '').trim();
    let teeTime = '';
    if (rawTime) {
      const ampmMatch = rawTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (ampmMatch) { teeTime = `${ampmMatch[1]}:${ampmMatch[2]} ${ampmMatch[3].toUpperCase()}`; }
      else {
        const timeMatch = rawTime.match(/(\d+):(\d+)/);
        if (timeMatch) { let h = Number(timeMatch[1]); const m = timeMatch[2]; teeTime = `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`; }
      }
    }
    const valid = !!name && !!p1 && /^\d{4,6}$/.test(pin);
    return { name, players: [p1, p2, p3, p4], pin, startingHole: startHole, teeTime, valid };
  }).filter(t => t.name);
}

function buildCsvDiff(csvTeams) {
  const existingByName = {};
  Object.entries(teamsCache).forEach(([id, team]) => { existingByName[team.name.toLowerCase()] = { id, team }; });
  const csvNames = new Set(); const toAdd = []; const toUpdate = [];
  csvTeams.filter(t => t.valid).forEach(t => {
    const key = t.name.toLowerCase(); csvNames.add(key);
    if (existingByName[key]) toUpdate.push({ csvTeam: t, existing: existingByName[key] });
    else toAdd.push(t);
  });
  const toRemove = Object.entries(teamsCache).filter(([, team]) => !csvNames.has(team.name.toLowerCase()));
  return { toAdd, toUpdate, toRemove };
}

function renderCsvPreview(teams) {
  if (teams.length === 0) { showAlert('No rows found in CSV.', 'error'); return; }
  const { toAdd, toUpdate, toRemove } = buildCsvDiff(teams);
  const invalidCount = teams.filter(t => !t.valid).length;
  let summary = `<p style="font-size:0.875rem;margin-bottom:0.75rem;color:var(--gray-700);">`;
  if (toAdd.length)    summary += `<span style="color:var(--green);margin-right:1rem;">➕ ${toAdd.length} add</span>`;
  if (toUpdate.length) summary += `<span style="color:var(--teal);margin-right:1rem;">✏️ ${toUpdate.length} update</span>`;
  if (toRemove.length) summary += `<span style="color:var(--orange);margin-right:1rem;">🗑️ ${toRemove.length} remove</span>`;
  if (invalidCount)    summary += `<span style="color:var(--red);">✗ ${invalidCount} invalid (skipped)</span>`;
  summary += `</p>`;
  let html = summary + `<div style="max-height:260px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:var(--radius);"><table style="width:100%;border-collapse:collapse;font-size:0.8125rem;"><thead style="background:var(--gray-50);"><tr><th style="padding:0.5rem;text-align:left;border-bottom:1px solid var(--gray-200);">Action</th><th style="padding:0.5rem;text-align:left;border-bottom:1px solid var(--gray-200);">Team</th><th style="padding:0.5rem;text-align:left;border-bottom:1px solid var(--gray-200);">Players</th><th style="padding:0.5rem;text-align:center;border-bottom:1px solid var(--gray-200);">Hole</th><th style="padding:0.5rem;text-align:center;border-bottom:1px solid var(--gray-200);">Tee Time</th></tr></thead><tbody>`;
  toAdd.forEach(t => { html += `<tr style="border-bottom:1px solid var(--gray-100);background:#F0FDF4;"><td style="padding:0.5rem;font-weight:700;color:var(--green);">Add</td><td style="padding:0.5rem;font-weight:600;">${escHtml(t.name)}</td><td style="padding:0.5rem;color:var(--gray-500);">${escHtml(t.players.filter(p=>p).join(', '))}</td><td style="padding:0.5rem;text-align:center;">${t.startingHole}</td><td style="padding:0.5rem;text-align:center;">${escHtml(t.teeTime)}</td></tr>`; });
  toUpdate.forEach(({ csvTeam: t }) => { html += `<tr style="border-bottom:1px solid var(--gray-100);background:#EFF6FF;"><td style="padding:0.5rem;font-weight:700;color:var(--teal);">Update</td><td style="padding:0.5rem;font-weight:600;">${escHtml(t.name)}</td><td style="padding:0.5rem;color:var(--gray-500);">${escHtml(t.players.filter(p=>p).join(', '))}</td><td style="padding:0.5rem;text-align:center;">${t.startingHole}</td><td style="padding:0.5rem;text-align:center;">${escHtml(t.teeTime)}</td></tr>`; });
  toRemove.forEach(([, team]) => { html += `<tr style="border-bottom:1px solid var(--gray-100);background:#FFF7ED;"><td style="padding:0.5rem;font-weight:700;color:var(--orange);">Remove</td><td style="padding:0.5rem;font-weight:600;">${escHtml(team.name)}</td><td style="padding:0.5rem;color:var(--gray-500);">${escHtml(Object.values(team.players||{}).filter(p=>p).join(', '))}</td><td style="padding:0.5rem;text-align:center;">${team.startingHole||1}</td><td style="padding:0.5rem;text-align:center;">${escHtml(team.teeTime||'')}</td></tr>`; });
  html += '</tbody></table></div>';
  csvPreviewContent.innerHTML = html;
  csvPreview.style.display    = 'block';
  csvDropArea.style.display   = 'none';
}

csvImportBtn.addEventListener('click', async () => {
  const { toAdd, toUpdate, toRemove } = buildCsvDiff(csvParsedTeams);
  if (toAdd.length === 0 && toUpdate.length === 0 && toRemove.length === 0) { showAlert('No changes to apply.', 'error'); return; }
  csvImportBtn.disabled = true; csvImportBtn.textContent = 'Saving…';
  try {
    const updates = {};
    toUpdate.forEach(({ csvTeam, existing }) => {
      const teamData = { name: csvTeam.name, players: csvTeam.players, pin: csvTeam.pin, startingHole: csvTeam.startingHole, teeTime: csvTeam.teeTime };
      if (existing.team.scores) teamData.scores = existing.team.scores;
      updates[`tournament/teams/${existing.id}`] = teamData;
    });
    toRemove.forEach(([id]) => { updates[`tournament/teams/${id}`] = null; });
    if (Object.keys(updates).length) await db.ref().update(updates);
    await Promise.all(toAdd.map(t => db.ref('tournament/teams').push({ name: t.name, players: t.players, pin: t.pin, startingHole: t.startingHole, teeTime: t.teeTime })));
    const parts = [];
    if (toAdd.length)    parts.push(`${toAdd.length} added`);
    if (toUpdate.length) parts.push(`${toUpdate.length} updated`);
    if (toRemove.length) parts.push(`${toRemove.length} removed`);
    showAlert(`Done — ${parts.join(', ')}.`, 'success');
    resetCsvImport();
  } catch (err) {
    showAlert('Error: ' + err.message, 'error');
    csvImportBtn.disabled = false; csvImportBtn.textContent = 'Import Teams';
  }
});

csvCancelBtn.addEventListener('click', resetCsvImport);

function resetCsvImport() {
  csvParsedTeams = []; csvFileInput.value = '';
  csvPreview.style.display = 'none'; csvDropArea.style.display = 'block';
  csvPreviewContent.innerHTML = ''; csvImportBtn.disabled = false; csvImportBtn.textContent = 'Import Teams';
}

// ── Clear All Data ────────────────────────────────────────────
const clearDataBtn   = document.getElementById('clear-data-btn');
const clearDataModal = document.getElementById('clear-data-modal');
const clearConfirmPw = document.getElementById('clear-confirm-password');
const clearError     = document.getElementById('clear-error');
const clearConfirmBtn = document.getElementById('clear-confirm-btn');
const clearCancelBtn  = document.getElementById('clear-cancel-btn');

clearDataBtn.addEventListener('click', () => {
  clearConfirmPw.value = ''; clearError.textContent = '';
  clearDataModal.classList.remove('hidden');
  setTimeout(() => clearConfirmPw.focus(), 50);
});
clearCancelBtn.addEventListener('click', () => { clearDataModal.classList.add('hidden'); });
clearDataModal.addEventListener('click', e => { if (e.target === clearDataModal) clearDataModal.classList.add('hidden'); });

clearConfirmBtn.addEventListener('click', async () => {
  if (clearConfirmPw.value !== ADMIN_PASSWORD) {
    clearError.textContent = 'Incorrect password.'; clearConfirmPw.focus(); return;
  }
  clearConfirmBtn.disabled = true; clearConfirmBtn.textContent = 'Deleting…';
  try {
    await db.ref('tournament/teams').remove();
    clearDataModal.classList.add('hidden');
    showAlert('All teams and scores have been deleted.', 'success');
  } catch (err) {
    clearError.textContent = 'Error: ' + err.message;
    clearConfirmBtn.disabled = false; clearConfirmBtn.textContent = 'Delete Everything';
  }
});

// ── Helpers ───────────────────────────────────────────────────
function showAlert(msg, type) {
  const el = document.getElementById('admin-alert');
  el.textContent = msg; el.className = `alert alert-${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3500);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
