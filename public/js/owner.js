const state = {
  participants: [],
  status: 'setup',
};

const el = (id) => document.getElementById(id);

const ICONS = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="13" height="13" x="9" y="9" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5Z" /></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5" /></svg>',
  reopen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.4 6.7 19.1l1-5.8L3.5 9.2l5.9-.9L12 3Z" /></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" /></svg>',
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Užklausa nepavyko (${res.status})`);
  return data;
}

function showError(node, message) {
  node.textContent = message;
  node.hidden = !message;
}

function absoluteLink(link) {
  return `${location.origin}${link}`;
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    temp.remove();
  }
  const original = button.innerHTML;
  button.innerHTML = `${ICONS.copy} Nukopijuota`;
  setTimeout(() => {
    button.innerHTML = original;
  }, 1400);
}

/* ---------------- Auth ---------------- */

el('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = el('login-error');
  showError(errorBox, '');
  try {
    await api('/api/owner/login', { method: 'POST', body: JSON.stringify({ password: el('password').value }) });
    el('password').value = '';
    await enterDashboard();
  } catch (err) {
    showError(errorBox, err.message);
  }
});

el('logout').addEventListener('click', async () => {
  await api('/api/owner/logout', { method: 'POST' }).catch(() => {});
  el('dash-view').hidden = true;
  el('logout').hidden = true;
  el('status-pill').hidden = true;
  el('login-view').hidden = false;
});

async function enterDashboard() {
  el('login-view').hidden = true;
  el('dash-view').hidden = false;
  el('logout').hidden = false;
  el('status-pill').hidden = false;
  await refresh();
}

/* ---------------- Rendering ---------------- */

function renderStatus() {
  const labels = { setup: 'Ruošiama', live: 'Vyksta', ended: 'Baigta' };
  const pill = el('status-pill');
  pill.className = `pill ${state.status}`;
  el('status-text').textContent = labels[state.status] || state.status;

  const button = el('primary-action');
  if (state.status === 'setup') {
    button.className = 'btn primary';
    button.innerHTML = `${ICONS.play} Pradėti renginį`;
    button.disabled = state.participants.length < 2;
  } else if (state.status === 'live') {
    button.className = 'btn primary';
    button.innerHTML = `${ICONS.stop} Baigti renginį`;
    button.disabled = false;
  } else {
    button.className = 'btn gold';
    button.innerHTML = `${ICONS.reopen} Atidaryti iš naujo`;
    button.disabled = false;
  }
}

const personTemplate = (p) => {
  const canEdit = state.status === 'setup';
  const tags = [
    `<span class="tag ${p.joined ? 'on' : ''}">${p.joined ? 'Atidarė' : 'Neatidarė'}</span>`,
    `<span class="tag ${p.spun ? 'on' : ''}">${p.spun ? 'Ištraukė' : 'Netraukė'}</span>`,
  ];
  if (p.target) tags.push(`<span class="tag gift">Dovanoja ${esc(p.target)}</span>`);

  return `
    <li class="person" data-id="${p.id}">
      <span class="avatar a${p.id % 4}">${esc(initials(p.name))}</span>
      <div class="info">
        <div class="name">${esc(p.name)}</div>
        <span class="link">${esc(absoluteLink(p.link))}</span>
      </div>
      <div class="tags">${tags.join('')}</div>
      <div class="actions">
        <button class="btn sm gold" data-action="copy" data-link="${esc(p.link)}">${ICONS.copy} Kopijuoti</button>
        <button class="btn sm ghost" data-action="rename" title="Pervadinti">${ICONS.pencil}</button>
        <button class="btn sm ghost" data-action="relink" title="Nauja nuoroda" ${canEdit ? '' : 'disabled'}>${ICONS.refresh}</button>
        <button class="btn sm ghost" data-action="delete" title="Pašalinti" ${canEdit ? '' : 'disabled'}>${ICONS.trash}</button>
      </div>
    </li>`;
};

function render() {
  const people = state.participants;
  const joined = people.filter((p) => p.joined).length;
  const spun = people.filter((p) => p.spun).length;

  el('stat-total').textContent = people.length;
  el('stat-joined').textContent = joined;
  el('stat-spun').textContent = spun;
  el('stat-waiting').textContent = people.length - spun;

  const pct = people.length ? Math.round((spun / people.length) * 100) : 0;
  el('progress-bar').style.width = `${pct}%`;

  if (state.status === 'setup') {
    el('progress-text').textContent = people.length < 2
      ? 'Pridėk bent 2 dalyvius, kad galėtum pradėti renginį.'
      : 'Viskas paruošta. Pradėk renginį, kad dalyviai galėtų traukti vardus.';
  } else if (state.status === 'live') {
    el('progress-text').textContent = `${spun} iš ${people.length} dalyvių jau traukė vardą.`;
  } else {
    el('progress-text').textContent = `Renginys baigtas. Traukė ${spun} iš ${people.length} dalyvių.`;
  }

  const addCard = el('add-card');
  const lockedMsg = 'Dalyvius galima keisti tik prieš renginio pradžią.';
  el('add-error').hidden = state.status === 'setup' ? el('add-error').hidden : false;
  if (state.status !== 'setup') {
    el('add-error').textContent = lockedMsg;
  } else if (el('add-error').textContent === lockedMsg) {
    el('add-error').hidden = true;
  }
  el('new-name').disabled = state.status !== 'setup';
  addCard.style.opacity = state.status === 'setup' ? '1' : '0.7';

  el('people-empty').hidden = people.length > 0;
  el('people').innerHTML = people.map(personTemplate).join('');

  const resultsCard = el('results-card');
  const withTarget = people.filter((p) => p.target);
  resultsCard.hidden = state.status === 'setup' && withTarget.length === 0;
  el('results').innerHTML = withTarget.map(personTemplate).join('');
  el('results-empty').hidden = withTarget.length > 0;

  renderStatus();
}

async function refresh() {
  try {
    const data = await api('/api/state');
    state.participants = data.participants;
    state.status = data.status;
    el('brand-title').textContent = data.eventTitle;
    render();
  } catch (err) {
    if (/neprisijung|not authorised/i.test(err.message)) {
      el('dash-view').hidden = true;
      el('logout').hidden = true;
      el('status-pill').hidden = true;
      el('login-view').hidden = false;
    }
  }
}

/* ---------------- Actions ---------------- */

el('add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = el('add-error');
  showError(errorBox, '');
  const name = el('new-name').value.trim();
  if (!name) return;
  try {
    await api('/api/participants', { method: 'POST', body: JSON.stringify({ name }) });
    el('new-name').value = '';
    await refresh();
  } catch (err) {
    showError(errorBox, err.message);
  }
});

el('primary-action').addEventListener('click', async () => {
  const errorBox = el('draw-error');
  showError(errorBox, '');
  try {
    if (state.status === 'setup') {
      if (!confirm('Pradėti renginį? Dalyviai galės traukti vardus, o jų nebegalėsi pridėti ar pašalinti.')) return;
      await api('/api/event/start', { method: 'POST' });
    } else if (state.status === 'live') {
      if (!confirm('Baigti renginį? Kas dar netraukė vardo, daugiau nebegalės.')) return;
      await api('/api/event/end', { method: 'POST' });
    } else {
      await api('/api/event/reopen', { method: 'POST' });
    }
    await refresh();
  } catch (err) {
    showError(errorBox, err.message);
  }
});

el('reset-event').addEventListener('click', async () => {
  const errorBox = el('draw-error');
  showError(errorBox, '');
  if (!confirm('Atstatyti viską? Visi traukimai bus ištrinti, o renginys grįš į ruošimo būseną.')) return;
  try {
    await api('/api/event/reset', { method: 'POST' });
    await refresh();
  } catch (err) {
    showError(errorBox, err.message);
  }
});

el('people').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.closest('.person').dataset.id;
  if (button.dataset.action === 'copy') copyText(absoluteLink(button.dataset.link), button);
  if (button.dataset.action === 'rename') handleRename(id);
  if (button.dataset.action === 'relink') handleRelink(id);
  if (button.dataset.action === 'delete') handleDelete(id);
});

async function handleRename(id) {
  const person = state.participants.find((p) => String(p.id) === String(id));
  const name = prompt('Naujas šio dalyvio vardas:', person ? person.name : '');
  if (name === null || !name.trim()) return;
  try {
    await api(`/api/participants/${id}/name`, { method: 'POST', body: JSON.stringify({ name }) });
    await refresh();
  } catch (err) {
    alert(err.message);
  }
}

async function handleRelink(id) {
  if (!confirm('Sukurti naują nuorodą šiam dalyviui? Sena nuoroda nustos veikti.')) return;
  try {
    await api(`/api/participants/${id}/link`, { method: 'POST' });
    await refresh();
  } catch (err) {
    alert(err.message);
  }
}

async function handleDelete(id) {
  if (!confirm('Pašalinti šį dalyvį?')) return;
  try {
    await api(`/api/participants/${id}`, { method: 'DELETE' });
    await refresh();
  } catch (err) {
    alert(err.message);
  }
}

/* ---------------- Boot ---------------- */

(async function init() {
  try {
    const { owner } = await api('/api/owner/session');
    if (owner) await enterDashboard();
    else el('login-view').hidden = false;
  } catch {
    el('login-view').hidden = false;
  }
  setInterval(() => {
    if (!el('dash-view').hidden && document.visibilityState === 'visible') refresh();
  }, 6000);
})();
