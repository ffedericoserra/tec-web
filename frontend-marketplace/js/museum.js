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
  user: null,            // current user (from /auth/me)
  itemsByContent: new Map(), // cache: universalId -> Item[] (filtered to "owned by me")
  draft: null,           // local-only unpublished visit (no _id), or null
  tab: 'my-visits',
  visitSubTab: 'sequence',
  pickerOpen: false,
  pickerQuery: '',
  pickerSearch: '',
  addItemsSearch: '',
  visitDialogMode: 'create', // 'create' | 'edit'
  dragSrcIdx: null,      // sequence index currently being dragged
  dirty: false,          // unsaved local changes since last load/publish
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
    state.user = me.user;

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
  els.visitDialog    = document.getElementById('visitDialog');
  els.visitForm      = document.getElementById('visitForm');
  els.visitFormError = document.getElementById('visitFormError');
  els.visitDialogTitle = document.getElementById('visitDialogTitle');
  els.visitDeleteBtn = document.getElementById('visitDeleteBtn');
  els.visitCancelBtn = document.getElementById('visitCancelBtn');
  els.visitSaveBtn   = document.getElementById('visitSaveBtn');
  els.visitActions   = document.getElementById('visitActions');
  els.publishBtn     = document.getElementById('publishBtn');
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
    // Surgical close — full renderEditor() would clobber an in-flight
    // logistic textarea or any other transient editor state.
    if (!e.target.closest('.visit-picker') && state.pickerOpen) {
      state.pickerOpen = false;
      const menu = els.editor.querySelector('.visit-picker-menu');
      if (menu) menu.remove();
      const picker = els.editor.querySelector('.visit-picker');
      if (picker) picker.classList.remove('is-open');
      const toggle = document.getElementById('visitPickerToggle');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  });

  els.visitForm.addEventListener('submit', handleVisitFormSubmit);
  els.visitCancelBtn.addEventListener('click', () => els.visitDialog.close());
  els.visitDeleteBtn.addEventListener('click', handleDeleteVisit);
  els.publishBtn.addEventListener('click', publishVisit);
}

function markDirty() {
  state.dirty = true;
  updatePublishButton();
}

function markClean() {
  state.dirty = false;
  updatePublishButton();
}

function updatePublishButton() {
  if (!els.publishBtn) return;
  const hasVisit = !!state.selected;
  els.visitActions.hidden = !hasVisit;
  if (!hasVisit) return;
  // Enabled when: visit is a local draft (no _id) OR there are unsaved changes.
  const enabled = !state.selected._id || state.dirty;
  els.publishBtn.disabled = !enabled;
}

function confirmDiscardIfDirty() {
  if (!state.dirty) return true;
  return window.confirm('You have unpublished changes. Discard them?');
}

async function loadVisit(visitSlug) {
  try {
    const res = await api(`/visits/${visitSlug}`);
    state.selected = res.visit;
    state.selectedExpanded = new Set();
    markClean();
    const u = new URL(window.location.href);
    u.searchParams.set('visit', visitSlug);
    history.replaceState({}, '', u);
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    showError(`Couldn't load visit: ${err.message}`);
  }
}

function selectDraft() {
  state.selected = state.draft;
  state.selectedExpanded = new Set();
  const u = new URL(window.location.href);
  u.searchParams.delete('visit');
  history.replaceState({}, '', u);
}

function startNewDraft(meta) {
  state.draft = {
    _id: undefined,
    slug: undefined,
    title: meta.title,
    description: meta.description || '',
    length: meta.length || 'normal',
    isPublic: meta.isPublic !== false,
    sequence: [],
  };
  selectDraft();
  markDirty();
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
  updatePublishButton();
}

/* ---------- Visit editor ---------- */

function renderEditor() {
  if (!state.selected) {
    els.editor.innerHTML = `
      <div class="visit-editor-empty">
        <div>No visits yet — create one to start curating items for this museum.</div>
        <button class="new-visit-btn" type="button" id="emptyNewVisitBtn">+ New Visit</button>
      </div>`;
    document.getElementById('emptyNewVisitBtn')
      .addEventListener('click', () => openVisitDialog('create'));
    return;
  }

  const v = state.selected;
  const pickerOpen = state.pickerOpen;
  const q = (state.pickerQuery || '').toLowerCase();
  const filteredVisits = state.visits.filter(x => x.title.toLowerCase().includes(q));
  const draftMatchesQuery = state.draft && state.draft.title.toLowerCase().includes(q);
  const isDraft = state.selected === state.draft;
  const titleLabel = isDraft ? `${v.title || 'Untitled'} (draft)` : v.title;

  els.editor.innerHTML = `
    <div class="visit-header">
      <div class="visit-picker ${pickerOpen ? 'is-open' : ''}">
        <button type="button" class="visit-picker-toggle" id="visitPickerToggle" aria-expanded="${pickerOpen}">
          <span>${escapeHtml(titleLabel)}</span>
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        ${pickerOpen ? `
          <div class="visit-picker-menu" role="menu">
            <input type="search" id="visitPickerSearch" placeholder="Search" value="${escapeAttr(state.pickerQuery)}" />
            ${state.draft && draftMatchesQuery ? `
              <button type="button" class="pick ${isDraft ? 'is-current' : ''}" id="pickDraftBtn">
                ${escapeHtml(state.draft.title || 'Untitled')} <span class="pick-meta">(draft)</span>
              </button>` : ''}
            ${filteredVisits.length === 0 && !(state.draft && draftMatchesQuery)
              ? `<div class="empty">No matches.</div>`
              : filteredVisits.map(x => `
                <button type="button" class="pick ${x.slug === v.slug && !isDraft ? 'is-current' : ''}" data-slug="${escapeAttr(x.slug)}">
                  ${escapeHtml(x.title)}
                </button>`).join('')}
            <div class="picker-divider"></div>
            <button type="button" class="pick new-visit" id="pickerNewVisitBtn">+ New Visit</button>
          </div>` : ''}
      </div>
      <button type="button" class="edit-visit-info" id="editVisitInfoBtn">Edit Visit Info</button>
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
      if (btn.id === 'pickerNewVisitBtn') {
        state.pickerOpen = false;
        state.pickerQuery = '';
        renderEditor();
        openVisitDialog('create');
        return;
      }
      if (btn.id === 'pickDraftBtn') {
        state.pickerOpen = false;
        state.pickerQuery = '';
        if (state.selected !== state.draft) selectDraft();
        renderEditor();
        return;
      }
      const targetSlug = btn.dataset.slug;
      const isSwitching = targetSlug && targetSlug !== state.selected.slug;
      if (isSwitching && !confirmDiscardIfDirty()) {
        // Stay open on cancel
        return;
      }
      state.pickerOpen = false;
      state.pickerQuery = '';
      // Switching away from a draft drops it.
      if (isSwitching && state.draft && state.selected === state.draft) state.draft = null;
      if (isSwitching) await loadVisit(targetSlug);
      renderEditor();
    });
  });

  const editBtn = document.getElementById('editVisitInfoBtn');
  if (editBtn) editBtn.addEventListener('click', () => openVisitDialog('edit'));

  // Sub-tabs
  els.editor.querySelectorAll('.visit-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.visitSubTab = btn.dataset.sub;
      renderEditor();
    });
  });

  // Sequence card expand
  els.editor.querySelectorAll('.seq-card-head').forEach(head => {
    head.addEventListener('click', async () => {
      const idx = Number(head.dataset.idx);
      if (state.selectedExpanded.has(idx)) {
        state.selectedExpanded.delete(idx);
        renderEditor();
        return;
      }
      state.selectedExpanded.add(idx);
      renderEditor();
      const item = state.selected.sequence[idx].itemId;
      const uid = (typeof item === 'string') ? null : item?.contentId;
      if (uid && !state.itemsByContent.has(uid)) {
        try {
          await fetchItemsForContent(uid);
        } catch (err) {
          if (err.status === 401) { logout(); return; }
          state.itemsByContent.set(uid, []); // mark as resolved-but-empty so we don't reloop on loading
        }
        renderEditor();
      }
    });
  });

  // Swap item via row click
  els.editor.querySelectorAll('.seq-item-row').forEach(row => {
    row.addEventListener('click', () => {
      const seqIdx = Number(row.dataset.seqIdx);
      swapSeqItem(seqIdx, row.dataset.itemId);
    });
  });

  // Drag-and-drop reorder
  els.editor.querySelectorAll('.seq-card').forEach(card => {
    const idx = Number(card.dataset.idx);
    card.addEventListener('dragstart', (e) => {
      state.dragSrcIdx = idx;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      state.dragSrcIdx = null;
      els.editor.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e) => {
      if (state.dragSrcIdx === null || state.dragSrcIdx === idx) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (state.dragSrcIdx === null || state.dragSrcIdx === idx) return;
      reorderSequence(state.dragSrcIdx, idx);
    });
  });

  // Click-to-edit logistic strips
  els.editor.querySelectorAll('.logistic').forEach(el => {
    el.addEventListener('click', () => activateLogisticEdit(Number(el.dataset.idx)));
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

    const author = content?.author || '';
    const type = content?.type || '';

    blocks.push(`
      <div class="seq-card ${open ? 'is-open' : ''}" draggable="true" data-idx="${i}">
        <button type="button" class="seq-card-head" data-idx="${i}" aria-expanded="${open}">
          <span class="drag-handle" aria-hidden="true">⋮⋮</span>
          <span class="seq-num">${i + 1}</span>
          <span class="seq-title">${escapeHtml(title)}</span>
          <span class="seq-author">${author ? escapeHtml(author) : ''}</span>
          <span class="seq-type">${type ? escapeHtml(type) : ''}</span>
          <span class="chev" aria-hidden="true">▾</span>
        </button>
        ${open ? `
          <div class="seq-card-body">
            ${renderSeqItems(item, i)}
          </div>` : ''}
      </div>
    `);

    // Logistic info between entries (last entry: omit)
    if (i < visit.sequence.length - 1) {
      const txt = (entry.nextDirections || '').trim();
      blocks.push(`
        <div class="logistic ${txt ? '' : 'empty'}" data-idx="${i}" tabindex="0" title="Click to edit directions to the next step">
          <span class="logistic-text">${txt ? escapeHtml(txt) : 'Insert logistic info…'}</span>
        </div>
      `);
    }
  });

  return `<div class="sequence-list">${blocks.join('')}</div>`;
}

function renderSeqItems(currentItem, seqIdx) {
  if (!currentItem) return `<em>Item missing.</em>`;

  const uid = currentItem.contentId;
  const cached = state.itemsByContent.get(uid);

  if (cached === undefined) {
    return `<div class="seq-items-loading">Loading your items for this content…</div>`;
  }

  // Always include the currently-selected item, even if the user no longer
  // owns it (e.g. opened a public visit they didn't author).
  const list = [...cached];
  const currentId = typeof currentItem === 'string' ? currentItem : currentItem._id;
  if (!list.find(x => x._id === currentId)) list.unshift(currentItem);

  if (list.length === 0) {
    return `<div class="empty-list">No items in your collection for this content.</div>`;
  }

  return `
    <div class="seq-items-list">
      ${list.map(it => renderSeqItemRow(it, currentId, seqIdx)).join('')}
    </div>
  `;
}

function renderSeqItemRow(it, currentId, seqIdx) {
  const isCurrent = it._id === currentId;
  const aud = it.targetAudience || '—';
  const creator = it.creatorId?.username || '—';
  const tones = (it.descriptions || []).map(d => d.tone).join(', ') || '—';
  return `
    <button type="button" class="seq-item-row ${isCurrent ? 'is-current' : ''}" data-item-id="${escapeAttr(it._id)}" data-seq-idx="${seqIdx}">
      <span class="seq-item-marker" aria-hidden="true">${isCurrent ? '●' : '○'}</span>
      <span class="seq-item-aud">${escapeHtml(aud)}</span>
      <span class="seq-item-creator">${escapeHtml(creator)}</span>
      <span class="seq-item-tones">${escapeHtml(tones)}</span>
    </button>
  `;
}

async function fetchItemsForContent(uid) {
  const res = await api(`/items?contentId=${encodeURIComponent(uid)}`);
  const myId = state.user?._id;
  const purchased = new Set(state.user?.purchasedItems || []);
  const filtered = (res.items || []).filter(it => {
    const creator = it.creatorId?._id || it.creatorId;
    return creator === myId || purchased.has(it._id);
  });
  state.itemsByContent.set(uid, filtered);
  return filtered;
}

async function swapSeqItem(seqIdx, newItemId) {
  const entry = state.selected.sequence[seqIdx];
  const currentItem = entry.itemId;
  const currentId = typeof currentItem === 'string' ? currentItem : currentItem._id;
  if (currentId === newItemId) return;

  const uid = (typeof currentItem === 'string') ? null : currentItem.contentId;
  const cached = (uid && state.itemsByContent.get(uid)) || [];
  let newItem = cached.find(it => it._id === newItemId);
  if (!newItem) {
    try { newItem = (await api(`/items/${newItemId}`)).item; } catch (e) { return; }
  }

  state.selected.sequence[seqIdx] = { ...entry, itemId: newItem };
  markDirty();
  renderEditor();
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

/* ---------- Sequence editing (reorder + inline logistic) ---------- */

function reorderSequence(srcIdx, targetIdx) {
  if (srcIdx === targetIdx) return;

  const seq = [...state.selected.sequence];
  // Drop-on-idx-N puts the dragged card at idx N. splice(src,1) shifts
  // indices after src down by 1, so splice(target, 0) inserts at the
  // original target's position in both directions.
  const [moved] = seq.splice(srcIdx, 1);
  seq.splice(targetIdx, 0, moved);

  state.selected.sequence = seq;
  state.selectedExpanded = new Set();
  markDirty();
  renderEditor();
}

function activateLogisticEdit(idx) {
  const logEl = els.editor.querySelector(`.logistic[data-idx="${idx}"]`);
  if (!logEl || logEl.querySelector('textarea')) return; // already editing

  const original = state.selected.sequence[idx].nextDirections || '';

  logEl.classList.remove('empty');
  logEl.classList.add('editing');
  logEl.innerHTML = '';
  const ta = document.createElement('textarea');
  ta.className = 'logistic-input';
  ta.rows = 2;
  ta.value = original;
  ta.placeholder = 'Add directions to the next step…';
  logEl.appendChild(ta);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);

  let resolved = false;
  const exit = (newVal) => {
    logEl.classList.remove('editing');
    logEl.innerHTML = `<span class="logistic-text">${newVal ? escapeHtml(newVal) : 'Insert logistic info…'}</span>`;
    logEl.classList.toggle('empty', !newVal);
  };

  const finish = (commit) => {
    if (resolved) return;
    resolved = true;

    if (!commit) { exit(original); return; }

    const newVal = ta.value.trim();
    if (newVal === original) { exit(original); return; }

    state.selected.sequence[idx].nextDirections = newVal;
    exit(newVal);
    markDirty();
  };

  ta.addEventListener('blur', () => finish(true));
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ta.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
}

/* ---------- Visit dialog (create / edit / delete) ---------- */

function openVisitDialog(mode) {
  state.visitDialogMode = mode;
  els.visitFormError.textContent = '';
  els.visitSaveBtn.disabled = false;

  const f = els.visitForm;
  // NB: f.elements.length is the built-in count, not the <select name="length">.
  // Use namedItem() to access named controls that collide with built-ins.
  if (mode === 'edit' && state.selected) {
    els.visitDialogTitle.textContent = 'Edit Visit Info';
    f.elements.namedItem('title').value = state.selected.title || '';
    f.elements.namedItem('description').value = state.selected.description || '';
    f.elements.namedItem('length').value = state.selected.length || 'normal';
    f.elements.namedItem('isPublic').checked = state.selected.isPublic !== false;
    els.visitDeleteBtn.hidden = false;
  } else {
    els.visitDialogTitle.textContent = 'New Visit';
    f.reset();
    f.elements.namedItem('length').value = 'normal';
    f.elements.namedItem('isPublic').checked = true;
    els.visitDeleteBtn.hidden = true;
  }

  els.visitDialog.showModal();
  const t = f.elements.namedItem('title');
  t.focus();
  t.setSelectionRange(t.value.length, t.value.length);
}

function handleVisitFormSubmit(e) {
  e.preventDefault();
  els.visitFormError.textContent = '';

  const f = els.visitForm;
  if (!f.checkValidity()) {
    f.reportValidity();
    return;
  }

  const data = new FormData(f);
  const meta = {
    title: data.get('title').trim(),
    description: (data.get('description') || '').trim(),
    length: data.get('length'),
    isPublic: f.elements.namedItem('isPublic').checked,
  };

  if (state.visitDialogMode === 'create') {
    if (state.dirty && !confirmDiscardIfDirty()) return;
    if (state.draft && state.selected !== state.draft) {
      // there's a stray draft we're not currently on — drop it before replacing
      state.draft = null;
    }
    startNewDraft(meta);
    state.visitSubTab = 'sequence';
  } else {
    // Edit mode: stage metadata changes locally; Publish persists.
    Object.assign(state.selected, meta);
    if (state.selected !== state.draft) {
      state.visits = state.visits.map(v =>
        v._id === state.selected._id ? { ...v, ...meta } : v
      );
    }
    markDirty();
  }

  els.visitDialog.close();
  renderEditor();
}

async function handleDeleteVisit() {
  if (!state.selected) return;
  const ok = window.confirm(`Delete "${state.selected.title}"? This cannot be undone.`);
  if (!ok) return;

  const isDraft = !state.selected._id;

  if (!isDraft) {
    els.visitSaveBtn.disabled = true;
    try {
      await api(`/visits/${state.selected._id}`, { method: 'DELETE' });
      state.visits = state.visits.filter(v => v._id !== state.selected._id);
    } catch (err) {
      els.visitSaveBtn.disabled = false;
      if (err.status === 401) { logout(); return; }
      els.visitFormError.textContent = err.message;
      return;
    }
  } else {
    state.draft = null;
  }

  if (state.visits.length > 0) {
    await loadVisit(state.visits[0].slug);
  } else {
    state.selected = null;
    state.draft = null;
    markClean();
    const u = new URL(window.location.href);
    u.searchParams.delete('visit');
    history.replaceState({}, '', u);
  }

  els.visitDialog.close();
  renderEditor();
}

async function publishVisit() {
  if (!state.selected || els.publishBtn.disabled) return;
  const isDraft = !state.selected._id;

  const sequencePayload = (state.selected.sequence || []).map(entry => ({
    itemId: typeof entry.itemId === 'string' ? entry.itemId : entry.itemId._id,
    nextDirections: entry.nextDirections || '',
    prevDirections: entry.prevDirections || '',
  }));

  const meta = {
    title: state.selected.title,
    description: state.selected.description || '',
    length: state.selected.length || 'normal',
    isPublic: state.selected.isPublic !== false,
  };

  els.publishBtn.disabled = true;
  els.publishBtn.textContent = isDraft ? 'Publishing…' : 'Saving…';
  try {
    let saved;
    if (isDraft) {
      saved = (await api('/visits', {
        method: 'POST',
        body: JSON.stringify({
          ...meta,
          museumId: state.museum._id,
          sequence: sequencePayload,
        }),
      })).visit;
      state.draft = null;
      state.visits.unshift(saved);
    } else {
      saved = (await api(`/visits/${state.selected._id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...meta, sequence: sequencePayload }),
      })).visit;
      state.visits = state.visits.map(v =>
        v._id === saved._id ? { ...v, ...saved } : v
      );
    }

    // Reload to get the populated sequence + clean state.
    await loadVisit(saved.slug);
    renderEditor();
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    alert(`Couldn't publish: ${err.message}`);
    updatePublishButton();
  } finally {
    els.publishBtn.textContent = 'Publish';
  }
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
