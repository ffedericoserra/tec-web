import { api, setCachedUser } from './api.js';
import { isAuthenticated, logout } from './auth.js';
import { mountProfile } from './profile.js';

const slug = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || '');

const state = {
  museum: null,
  visits: [],            // user's visits for this museum (light list)
  selected: null,        // populated current visit (full)
  selectedExpanded: new Set(), // expanded sequence-entry indices
  contents: [],
  contentByUid: new Map(),
  tab: 'my-visits',
  visitSubTab: 'sequence',
  pickerOpen: false,
  pickerQuery: '',
  pickerSearch: '',
  addItemsSearch: '',
};

const els = {};

async function init() {
  cacheEls();
  bindStaticUI();

  try {
    const [me, museumRes] = await Promise.all([
      api('/auth/me'),
      api(`/museums/${slug}`),
    ]);
    setCachedUser(me.user);
    mountProfile(me.user);

    state.museum = museumRes.museum;
    document.title = `${state.museum.name} — ArtAround`;
    els.museumName.textContent = state.museum.name;

    const [visitsRes, contentsRes] = await Promise.all([
      api(`/visits/my?museumId=${state.museum._id}`),
      api(`/museums/${slug}/contents`),
    ]);
    state.visits = visitsRes.visits || [];
    state.contents = contentsRes.contents || [];
    state.contentByUid = new Map(state.contents.map(c => [c.universalId, c]));

    const params = new URLSearchParams(window.location.search);
    const wanted = params.get('visit');
    const initialSlug = (wanted && state.visits.find(v => v.slug === wanted))
      ? wanted
      : state.visits[0]?.slug;

    if (initialSlug) await loadVisit(initialSlug);
    render();
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    showError(err.status === 404 ? 'Museum not found.' : err.message);
  }
}

function cacheEls() {
  els.museumName     = document.getElementById('museumName');
  els.errorBanner    = document.getElementById('errorBanner');
  els.tabs           = document.querySelectorAll('.m-tab');
  els.panels         = document.querySelectorAll('.panel');
  els.editor         = document.getElementById('visitEditor');
  els.pickerSearch   = document.getElementById('contentPickerSearch');
  els.pickerList     = document.getElementById('contentPickerList');
  els.addItemsSearch = document.getElementById('addItemsSearch');
  els.contentGrid    = document.getElementById('contentGrid');
}

function bindStaticUI() {
  els.tabs.forEach(t => t.addEventListener('click', () => {
    state.tab = t.dataset.tab;
    render();
  }));
  els.pickerSearch.addEventListener('input', () => {
    state.pickerSearch = els.pickerSearch.value;
    renderContentPicker();
  });
  els.addItemsSearch.addEventListener('input', () => {
    state.addItemsSearch = els.addItemsSearch.value;
    renderAddItems();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.visit-picker') && state.pickerOpen) {
      state.pickerOpen = false;
      renderEditor();
    }
  });
}

async function loadVisit(visitSlug) {
  try {
    const res = await api(`/visits/${visitSlug}`);
    state.selected = res.visit;
    state.selectedExpanded = new Set();
    const u = new URL(window.location.href);
    u.searchParams.set('visit', visitSlug);
    history.replaceState({}, '', u);
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    showError(`Couldn't load visit: ${err.message}`);
  }
}

function render() {
  els.tabs.forEach(t => {
    const active = t.dataset.tab === state.tab;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  els.panels.forEach(p => { p.hidden = p.dataset.panel !== state.tab; });

  if (state.tab === 'my-visits') {
    renderEditor();
    renderContentPicker();
  } else {
    renderAddItems();
  }
}

/* ---------- Visit editor ---------- */

function renderEditor() {
  if (state.visits.length === 0) {
    els.editor.innerHTML = `
      <div class="visit-editor-empty">
        <div>No visits yet — create one to start curating items for this museum.</div>
        <button class="new-visit-btn" type="button" disabled>+ New Visit</button>
      </div>`;
    return;
  }

  if (!state.selected) {
    els.editor.innerHTML = `<div class="visit-editor-empty">Select a visit.</div>`;
    return;
  }

  const v = state.selected;
  const pickerOpen = state.pickerOpen;
  const pickerQuery = state.pickerSearch || '';
  const filteredVisits = state.visits.filter(x =>
    x.title.toLowerCase().includes((state.pickerQuery || '').toLowerCase())
  );

  els.editor.innerHTML = `
    <div class="visit-header">
      <div class="visit-picker ${pickerOpen ? 'is-open' : ''}">
        <button type="button" class="visit-picker-toggle" id="visitPickerToggle" aria-expanded="${pickerOpen}">
          <span>${escapeHtml(v.title)}</span>
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        ${pickerOpen ? `
          <div class="visit-picker-menu" role="menu">
            <input type="search" id="visitPickerSearch" placeholder="Search" value="${escapeAttr(state.pickerQuery)}" />
            ${filteredVisits.length === 0
              ? `<div class="empty">No matches.</div>`
              : filteredVisits.map(x => `
                <button type="button" class="pick ${x.slug === v.slug ? 'is-current' : ''}" data-slug="${escapeAttr(x.slug)}">
                  ${escapeHtml(x.title)}
                </button>`).join('')}
          </div>` : ''}
      </div>
      <a class="edit-visit-info" aria-disabled="true" title="Coming soon">Edit Visit Info</a>
    </div>

    <div class="visit-subtabs" role="tablist">
      <button type="button" class="visit-subtab ${state.visitSubTab === 'sequence' ? 'is-active' : ''}" data-sub="sequence">Visit Sequence</button>
      <button type="button" class="visit-subtab ${state.visitSubTab === 'items' ? 'is-active' : ''}" data-sub="items">Associated Items</button>
    </div>

    <div class="visit-sub-content">
      ${state.visitSubTab === 'sequence' ? renderSequence(v) : renderAssociatedItems(v)}
    </div>
  `;

  // Wire visit picker
  const toggle = document.getElementById('visitPickerToggle');
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    state.pickerOpen = !state.pickerOpen;
    state.pickerQuery = '';
    renderEditor();
  });
  const searchInput = document.getElementById('visitPickerSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.pickerQuery = searchInput.value;
      renderEditor();
      // Restore focus and caret position on rerender
      const fresh = document.getElementById('visitPickerSearch');
      if (fresh) {
        fresh.focus();
        fresh.setSelectionRange(state.pickerQuery.length, state.pickerQuery.length);
      }
    });
    searchInput.focus();
  }
  els.editor.querySelectorAll('.pick').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.pickerOpen = false;
      state.pickerQuery = '';
      const targetSlug = btn.dataset.slug;
      if (targetSlug !== state.selected.slug) await loadVisit(targetSlug);
      renderEditor();
    });
  });

  // Sub-tabs
  els.editor.querySelectorAll('.visit-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.visitSubTab = btn.dataset.sub;
      renderEditor();
    });
  });

  // Sequence card expand
  els.editor.querySelectorAll('.seq-card-head').forEach(head => {
    head.addEventListener('click', () => {
      const idx = Number(head.dataset.idx);
      if (state.selectedExpanded.has(idx)) state.selectedExpanded.delete(idx);
      else state.selectedExpanded.add(idx);
      renderEditor();
    });
  });
}

function renderSequence(visit) {
  if (!visit.sequence || visit.sequence.length === 0) {
    return `<div class="empty-list">This visit has no items yet.</div>`;
  }

  const blocks = [];
  visit.sequence.forEach((entry, i) => {
    const open = state.selectedExpanded.has(i);
    const item = entry.itemId; // populated
    const content = item && state.contentByUid.get(item.contentId);

    const title = content?.name || '(unknown content)';
    const subtitle = contentSubtitle(content);

    blocks.push(`
      <div class="seq-card ${open ? 'is-open' : ''}">
        <button type="button" class="seq-card-head" data-idx="${i}" aria-expanded="${open}">
          <span class="seq-num">${i + 1}</span>
          <span class="seq-title">${escapeHtml(title)}</span>
          <span class="seq-author">${escapeHtml(subtitle)}</span>
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        ${open ? `
          <div class="seq-card-body">
            ${renderSeqDetails(item, content)}
          </div>` : ''}
      </div>
    `);

    // Logistic info between entries (last entry: omit)
    if (i < visit.sequence.length - 1) {
      const txt = (entry.nextDirections || '').trim();
      blocks.push(`
        <div class="logistic ${txt ? '' : 'empty'}">
          ${txt ? escapeHtml(txt) : 'Insert logistic info…'}
        </div>
      `);
    }
  });

  return `<div class="sequence-list">${blocks.join('')}</div>`;
}

function renderSeqDetails(item, content) {
  if (!item) return `<em>Item missing.</em>`;
  const tones = (item.descriptions || []).map(d => d.tone);
  const lengths = new Set();
  (item.descriptions || []).forEach(d => (d.texts || []).forEach(t => lengths.add(t.lengthCategory)));
  return `
    <dl>
      ${content ? `<dt>Type</dt><dd>${escapeHtml(content.type)}</dd>` : ''}
      ${item.targetAudience ? `<dt>Audience</dt><dd>${escapeHtml(item.targetAudience)}</dd>` : ''}
      ${item.creatorId?.username ? `<dt>By</dt><dd>${escapeHtml(item.creatorId.username)}</dd>` : ''}
      ${tones.length ? `<dt>Tones</dt><dd>${tones.map(escapeHtml).join(', ')}</dd>` : ''}
      ${lengths.size ? `<dt>Lengths</dt><dd>${[...lengths].map(escapeHtml).join(', ')}</dd>` : ''}
    </dl>
  `;
}

function renderAssociatedItems(visit) {
  if (!visit.sequence || visit.sequence.length === 0) {
    return `<div class="empty-list">No items in this visit.</div>`;
  }
  const rows = visit.sequence.map(entry => {
    const item = entry.itemId;
    const content = item && state.contentByUid.get(item.contentId);
    const title = content?.name || '(unknown)';
    const aud = item?.targetAudience || '—';
    return `
      <div class="assoc-item">
        <span>${escapeHtml(title)}</span>
        <span class="audience">${escapeHtml(aud)}</span>
      </div>`;
  });
  return `<div class="assoc-items">${rows.join('')}</div>`;
}

function contentSubtitle(content) {
  if (!content) return '';
  return content.author || content.type || '';
}

/* ---------- Content picker (right column) ---------- */

function renderContentPicker() {
  const q = state.pickerSearch.trim().toLowerCase();
  const list = state.contents
    .filter(c => !q || c.name.toLowerCase().includes(q) || (c.author || '').toLowerCase().includes(q));

  if (list.length === 0) {
    els.pickerList.innerHTML = `<div class="empty-list">No matches.</div>`;
    return;
  }
  els.pickerList.innerHTML = list.map(c => `
    <div class="cp-card" data-uid="${escapeAttr(c.universalId || '')}">
      <div class="cp-thumb">
        ${c.imageUrl ? `<img src="${escapeAttr(c.imageUrl)}" alt="" loading="lazy" />` : ''}
      </div>
      <span class="cp-name">${escapeHtml(c.name)}</span>
      <span class="cp-type">${escapeHtml(c.type)}</span>
      <button type="button" class="cp-add" disabled aria-disabled="true" title="Coming soon">+</button>
    </div>
  `).join('');
}

/* ---------- Add Items grid ---------- */

function renderAddItems() {
  const q = state.addItemsSearch.trim().toLowerCase();
  const list = state.contents
    .filter(c => !q || c.name.toLowerCase().includes(q) || (c.author || '').toLowerCase().includes(q));

  if (list.length === 0) {
    els.contentGrid.innerHTML = `<div class="empty-list">No content found.</div>`;
    return;
  }

  els.contentGrid.innerHTML = list.map(c => `
    <div class="ci-card">
      <div class="ci-frame">
        ${c.imageUrl ? `<img src="${escapeAttr(c.imageUrl)}" alt="" loading="lazy" />` : `<span class="ph">No image</span>`}
      </div>
      <div class="ci-name">${escapeHtml(c.name)}</div>
      <div class="ci-type">${escapeHtml(c.type)}${c.author ? ' · ' + escapeHtml(c.author) : ''}</div>
      <button type="button" class="ci-create" disabled>Create Item</button>
      <a class="ci-marketplace" aria-disabled="true">or select from Marketplace</a>
    </div>
  `).join('');
}

/* ---------- Helpers ---------- */

function showError(msg) {
  els.errorBanner.textContent = msg;
  els.errorBanner.hidden = false;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}

if (!isAuthenticated()) {
  window.location.replace('/marketplace');
} else {
  init();
}
