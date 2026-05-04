import { api, setCachedUser } from './api.js';
import { isAuthenticated, logout } from './auth.js';

const state = {
  museums: [],
  savedIds: new Set(),
  tab: 'all',
  query: '',
};

const els = {};

async function init() {
  els.grid = document.getElementById('grid');
  els.status = document.getElementById('status');
  els.search = document.getElementById('search');
  els.tabs = document.querySelectorAll('.tab');
  els.profileBtn = document.getElementById('profileBtn');
  els.profileMenu = document.getElementById('profileMenu');
  els.profileAvatar = document.getElementById('profileAvatar');
  els.profileUsername = document.getElementById('profileUsername');
  els.logoutBtn = document.getElementById('logoutBtn');

  bindUI();

  try {
    const [me, list] = await Promise.all([
      api('/auth/me'),
      api('/museums'),
    ]);
    setCachedUser(me.user);
    state.museums = list.museums || [];
    state.savedIds = new Set((me.user.savedMuseums || []).map(m => m._id || m));

    setProfile(me.user);
    render();
  } catch (err) {
    if (err.status === 401) {
      logout();
      return;
    }
    els.status.textContent = `Couldn't load museums: ${err.message}`;
    els.status.classList.add('error');
  }
}

function bindUI() {
  els.search.addEventListener('input', () => {
    state.query = els.search.value;
    render();
  });

  els.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      els.tabs.forEach(t => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      state.tab = tab.dataset.tab;
      render();
    });
  });

  els.profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = els.profileMenu.hidden;
    els.profileMenu.hidden = !open;
    els.profileBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', () => {
    els.profileMenu.hidden = true;
    els.profileBtn.setAttribute('aria-expanded', 'false');
  });

  els.logoutBtn.addEventListener('click', () => logout());
}

function setProfile(user) {
  els.profileUsername.textContent = user.username;
  els.profileAvatar.textContent = (user.username[0] || '?').toUpperCase();
}

function render() {
  const q = state.query.trim().toLowerCase();
  let list = state.museums;

  if (state.tab === 'saved') {
    list = list.filter(m => state.savedIds.has(m._id));
  }
  if (q) {
    list = list.filter(m => m.name.toLowerCase().includes(q));
  }

  if (list.length === 0) {
    els.grid.hidden = true;
    els.status.classList.remove('error');
    els.status.hidden = false;
    els.status.textContent =
      state.tab === 'saved' && state.savedIds.size === 0
        ? 'No saved museums yet. Browse "All Museums" and tap the heart to save one.'
        : q
        ? 'No museums match your search.'
        : 'No museums available.';
    return;
  }

  els.status.hidden = true;
  els.grid.hidden = false;
  els.grid.replaceChildren(...list.map(buildCard));
}

function buildCard(museum) {
  const card = document.createElement('article');
  card.className = 'card';
  card.tabIndex = 0;
  card.dataset.slug = museum.slug;

  if (museum.imageUrl) {
    const img = document.createElement('img');
    img.className = 'card-image';
    img.loading = 'lazy';
    img.alt = '';
    img.src = museum.imageUrl;
    card.appendChild(img);
  }

  const saved = state.savedIds.has(museum._id);
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = `save-toggle ${saved ? 'is-saved' : ''}`;
  saveBtn.textContent = saved ? '♥' : '♡';
  saveBtn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save museum');
  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSave(museum._id, saveBtn);
  });
  card.appendChild(saveBtn);

  const name = document.createElement('div');
  name.className = 'card-name';
  name.textContent = museum.name;
  card.appendChild(name);

  const open = () => {
    window.location.href = `/marketplace/museums/${museum.slug}`;
  };
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open();
    }
  });

  return card;
}

async function toggleSave(museumId, btn) {
  const wasSaved = state.savedIds.has(museumId);

  if (wasSaved) state.savedIds.delete(museumId);
  else state.savedIds.add(museumId);
  updateSaveBtn(btn, !wasSaved);

  try {
    await api(`/museums/${museumId}/save`, {
      method: wasSaved ? 'DELETE' : 'POST',
    });
    if (state.tab === 'saved') render();
  } catch (err) {
    if (wasSaved) state.savedIds.add(museumId);
    else state.savedIds.delete(museumId);
    updateSaveBtn(btn, wasSaved);
    if (err.status === 401) logout();
  }
}

function updateSaveBtn(btn, saved) {
  btn.classList.toggle('is-saved', saved);
  btn.textContent = saved ? '♥' : '♡';
  btn.setAttribute('aria-label', saved ? 'Remove from saved' : 'Save museum');
}

if (!isAuthenticated()) {
  window.location.replace('/marketplace');
} else {
  init();
}
