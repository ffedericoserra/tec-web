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
  publicItemsByContent: new Map(), // cache: universalId -> Item[] (public, from marketplace)
  chooserUid: null,      // universalId currently shown in the content chooser dialog
  chooserMode: null,     // 'no-items' | 'marketplace'
  chooserAppend: false,  // when true, after purchase append the item to the visit's sequence
  createItemUid: null,   // universalId currently shown in the Create Item dialog
  createItemContext: null, // 'chooser' | 'add-items' — drives post-publish behavior
  createItemMode: 'create', // 'create' | 'edit'
  createItemTone: 'easy',   // which tone tab the 3 textareas are currently editing
  createItemTexts: null,    // { easy: {'3s','15s','45s'}, medium: {...}, complex: {...} }
  editItem: null,        // populated item being edited (when createItemMode === 'edit')
  viewItemId: null,      // _id of the item shown in the View Item dialog
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
  els.chooserDialog  = document.getElementById('contentChooserDialog');
  els.chooserTitle   = document.getElementById('chooserTitle');
  els.chooserCloseBtn = document.getElementById('chooserCloseBtn');
  els.chooserCreateBtn = document.getElementById('chooserCreateBtn');
  els.chooserNoItemsMsg = document.getElementById('chooserNoItemsMsg');
  els.chooserSelectMarketplaceBtn = document.getElementById('chooserSelectMarketplaceBtn');
  els.chooserMarketSection = document.getElementById('chooserMarketSection');
  els.chooserMarketList = document.getElementById('chooserMarketList');
  els.chooserError   = document.getElementById('chooserError');
  els.viewItemDialog = document.getElementById('viewItemDialog');
  els.viewItemTitle  = document.getElementById('viewItemTitle');
  els.viewItemCloseBtn = document.getElementById('viewItemCloseBtn');
  els.viewItemContent = document.getElementById('viewItemContent');
  els.viewItemAud    = document.getElementById('viewItemAud');
  els.viewItemCreator = document.getElementById('viewItemCreator');
  els.viewItemLicense = document.getElementById('viewItemLicense');
  els.viewItemPublic = document.getElementById('viewItemPublic');
  els.viewItemPrice  = document.getElementById('viewItemPrice');
  els.viewItemDescriptions = document.getElementById('viewItemDescriptions');
  els.viewItemError  = document.getElementById('viewItemError');
  els.viewItemEditBtn = document.getElementById('viewItemEditBtn');
  els.viewItemDeleteBtn = document.getElementById('viewItemDeleteBtn');
  els.createItemDialog = document.getElementById('createItemDialog');
  els.createItemForm = document.getElementById('createItemForm');
  els.createItemToneTabs = document.getElementById('createItemToneTabs');
  els.createItemTitle = document.getElementById('createItemTitle');
  els.createItemThumb = document.getElementById('createItemThumb');
  els.createItemId = document.getElementById('createItemId');
  els.createItemType = document.getElementById('createItemType');
  els.createItemContentName = document.getElementById('createItemContentName');
  els.createItemAuthor = document.getElementById('createItemAuthor');
  els.createItemError = document.getElementById('createItemError');
  els.createItemCloseBtn = document.getElementById('createItemCloseBtn');
  els.createItemCancelBtn = document.getElementById('createItemCancelBtn');
  els.createItemSaveBtn = document.getElementById('createItemSaveBtn');
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

  els.chooserCloseBtn.addEventListener('click', closeContentChooser);
  els.chooserCreateBtn.addEventListener('click', () => {
    if (state.chooserUid) openCreateItemDialog(state.chooserUid, 'chooser');
  });
  els.chooserSelectMarketplaceBtn.addEventListener('click', () => {
    if (state.chooserUid) renderChooserMarketplace(state.chooserUid);
  });

  els.createItemForm.addEventListener('submit', handleCreateItemSubmit);
  els.createItemCloseBtn.addEventListener('click', closeCreateItemDialog);
  els.createItemCancelBtn.addEventListener('click', closeCreateItemDialog);

  els.createItemToneTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.ci-tone-tab');
    if (tab) switchTone(tab.dataset.tone);
  });
  // Keep the tab completeness dots live as the user types.
  for (const { field } of LENGTH_FIELDS) {
    els.createItemForm.elements.namedItem(field).addEventListener('input', () => {
      stashTextareasIntoTone();
      renderToneTabs();
    });
  }

  els.viewItemCloseBtn.addEventListener('click', closeViewItemDialog);
  els.viewItemEditBtn.addEventListener('click', startEditFromViewItem);
  els.viewItemDeleteBtn.addEventListener('click', deleteFromViewItem);
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

  // Item selection radios (inside expanded seq-card body)
  els.editor.querySelectorAll('.seq-item-radio').forEach(radio => {
    radio.addEventListener('change', (e) => {
      e.stopPropagation();
      selectSeqItem(Number(radio.dataset.idx), radio.dataset.itemId);
    });
    // The row sits inside .seq-card-body, which is not the head — but the label
    // click would still bubble up through any future wrapper. Keep it contained.
    radio.addEventListener('click', (e) => e.stopPropagation());
  });

  // View Item buttons (inside expanded seq-card body)
  els.editor.querySelectorAll('.seq-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openViewItemDialog(btn.dataset.itemId);
    });
  });

  // Buy from Marketplace button (one per expanded seq-card)
  els.editor.querySelectorAll('.seq-buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Content is already in sequence — purchase only, no append.
      openMarketplaceBrowser(btn.dataset.uid, { append: false });
    });
  });

  // Remove sequence entry
  els.editor.querySelectorAll('.seq-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // don't bubble to seq-card-head
      removeSeqEntry(Number(btn.dataset.idx));
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
            <div class="seq-card-actions">
              <button type="button" class="seq-remove-btn" data-idx="${i}">Remove from visit</button>
            </div>
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

  // Always include the currently-stored item even if the user doesn't own it
  // (e.g. inherited a public visit) — it's the selected one, so it has to be listed.
  // Switching away from such an item is one-way: it isn't in `itemsByContent`, so
  // it won't be offered again. That's intended — you can't select what you don't own.
  const list = [...cached];
  if (!list.find(x => x._id === currentItem._id)) list.unshift(currentItem);

  const rows = list
    .map(it => renderSeqItemRow(it, seqIdx, it._id === currentItem._id))
    .join('');

  return `
    <div class="seq-items-section">
      <h5>Item used in this visit</h5>
      ${rows}
    </div>
    <div class="seq-items-buy">
      <button type="button" class="seq-buy-btn" data-uid="${escapeAttr(uid)}">Create Item or buy from Marketplace</button>
    </div>
  `;
}

function renderSeqItemRow(it, seqIdx, isSelected) {
  const aud = it.targetAudience || '—';
  return `
    <div class="seq-item-row ${isSelected ? 'is-selected' : ''}" data-item-id="${escapeAttr(it._id)}">
      <label class="seq-item-pick">
        <input
          type="radio"
          class="seq-item-radio"
          name="seq-item-${seqIdx}"
          data-idx="${seqIdx}"
          data-item-id="${escapeAttr(it._id)}"
          ${isSelected ? 'checked' : ''}
        >
        <span class="seq-item-aud">${escapeHtml(aud)}</span>
      </label>
      <button type="button" class="seq-view-btn" data-item-id="${escapeAttr(it._id)}">View Item</button>
    </div>
  `;
}

/* Switch which owned item this sequence entry uses. Staged like every other
 * sequence edit — Publish persists it. */
function selectSeqItem(seqIdx, itemId) {
  const entry = state.selected?.sequence?.[seqIdx];
  if (!entry) return;

  const current = entry.itemId;
  if ((current?._id || current) === itemId) return;

  const uid = (typeof current === 'string') ? null : current?.contentId;
  const cached = uid ? (state.itemsByContent.get(uid) || []) : [];
  const next = cached.find(it => it._id === itemId);
  if (!next) return;

  entry.itemId = next;
  markDirty();
  renderEditor();
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

async function fetchPublicItemsForContent(uid) {
  const res = await api(`/items?contentId=${encodeURIComponent(uid)}&isPublic=true`);
  const items = res.items || [];
  state.publicItemsByContent.set(uid, items);
  return items;
}

function removeSeqEntry(seqIdx) {
  if (!state.selected || !Array.isArray(state.selected.sequence)) return;
  if (seqIdx < 0 || seqIdx >= state.selected.sequence.length) return;

  state.selected.sequence = state.selected.sequence.filter((_, i) => i !== seqIdx);

  // Rebuild expansion set: drop the removed index and shift down anything past it.
  const next = new Set();
  for (const i of state.selectedExpanded) {
    if (i === seqIdx) continue;
    next.add(i > seqIdx ? i - 1 : i);
  }
  state.selectedExpanded = next;

  markDirty();
  renderEditor();
  renderContentPicker(); // re-show the removed content in the right column
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
  // Hide contents already in the active visit's sequence — "When a content is added it
  // disappears from view, and appears again if removed from visit."
  const inSeq = sequenceContentIds();
  const list = state.contents
    .filter(c => !inSeq.has(c.universalId))
    .filter(c => !q || c.name.toLowerCase().includes(q) || (c.author || '').toLowerCase().includes(q));

  if (list.length === 0) {
    els.pickerList.innerHTML = `<div class="empty-list">${inSeq.size > 0 && !q ? 'All available contents are in this visit.' : 'No matches.'}</div>`;
    return;
  }
  // `+` is enabled only when a visit is selected — adding requires a target sequence.
  const canAdd = !!state.selected;
  const addTitle = canAdd ? 'Add to this visit' : 'Select or create a visit first';
  els.pickerList.innerHTML = list.map(c => `
    <div class="cp-card" data-uid="${escapeAttr(c.universalId || '')}">
      <div class="cp-thumb">
        ${c.imageUrl ? `<img src="${escapeAttr(c.imageUrl)}" alt="" loading="lazy" />` : ''}
      </div>
      <span class="cp-name">${escapeHtml(c.name)}</span>
      <span class="cp-type">${escapeHtml(c.type)}</span>
      <button type="button" class="cp-add" ${canAdd ? '' : 'disabled aria-disabled="true"'}
        title="${escapeAttr(addTitle)}" data-uid="${escapeAttr(c.universalId || '')}">+</button>
    </div>
  `).join('');

  els.pickerList.querySelectorAll('.cp-add:not([disabled])').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      addContentToVisit(btn.dataset.uid);
    });
  });
}

function sequenceContentIds() {
  const ids = new Set();
  for (const entry of (state.selected?.sequence || [])) {
    const it = entry.itemId;
    const uid = (it && typeof it === 'object') ? it.contentId : null;
    if (uid) ids.add(uid);
  }
  return ids;
}

// Add a content from the right column to the active visit.
// If the user already owns one or more items for this content, append the first one
// (created-by-me first, then bought-from-marketplace). Otherwise show a no-items prompt
// (Create Item / or select from Marketplace) — same dialog shell as the chooser.
async function addContentToVisit(uid) {
  if (!state.selected || !uid) return;
  // Defensive: shouldn't happen because renderContentPicker filters these out, but guard anyway.
  if (sequenceContentIds().has(uid)) return;

  let cached = state.itemsByContent.get(uid);
  if (cached === undefined) {
    try {
      cached = await fetchItemsForContent(uid);
    } catch (err) {
      if (err.status === 401) { logout(); return; }
      showError(`Couldn't load items: ${err.message}`);
      return;
    }
  }

  const firstOwned = pickDefaultItem(cached);
  if (firstOwned) {
    appendItemToSequence(firstOwned);
    return;
  }
  openNoItemsPrompt(uid);
}

// "First listed" default: prefer items the user created, then items they bought.
// Within each group keep the API order (newest first).
function pickDefaultItem(items) {
  if (!items || items.length === 0) return null;
  const myId = state.user?._id;
  const created = items.find(it => (it.creatorId?._id || it.creatorId) === myId);
  if (created) return created;
  const purchased = new Set(state.user?.purchasedItems || []);
  return items.find(it => purchased.has(it._id)) || null;
}

/* ---------- Content chooser dialog (no-items prompt + marketplace browser) ----------
 *
 * The dialog has two modes:
 *
 *   'no-items'   — shown when the user clicks `+` on the right-column content picker
 *                  for a content they don't yet own any item for. Shows a "Create Item"
 *                  button (opens Create Item dialog) and "or select from Marketplace"
 *                  link (switches the same dialog to 'marketplace' mode).
 *
 *   'marketplace' — shown when:
 *                   (a) user clicks "or select from Marketplace" inside the no-items
 *                       prompt — they're trying to add a not-yet-in-sequence content,
 *                       so a successful purchase appends it (state.chooserAppend = true).
 *                   (b) user clicks "Buy from Marketplace" inside an expanded seq-card
 *                       body — the content is already in the sequence, so a purchase
 *                       just adds the item to their library, no append.
 *                   (c) user clicks "or select from Marketplace" on the Add Items grid
 *                       — no visit context, no append.
 *
 * `state.chooserAppend` decides whether `purchaseAndUse(item)` calls
 * `appendItemToSequence(item)` after a successful purchase.
 */

function closeContentChooser() {
  els.chooserDialog.close();
  state.chooserUid = null;
  state.chooserMode = null;
  state.chooserAppend = false;
}

function openNoItemsPrompt(uid) {
  if (!uid) return;
  state.chooserUid = uid;
  state.chooserMode = 'no-items';
  state.chooserAppend = true; // creating an item via this prompt is followed by appendToSequence

  const content = state.contentByUid.get(uid);
  els.chooserTitle.textContent = content ? `Add an item — ${content.name}` : 'Add an item';
  els.chooserError.textContent = '';
  els.chooserNoItemsMsg.hidden = false;
  els.chooserCreateBtn.hidden = false;
  els.chooserSelectMarketplaceBtn.hidden = false;
  els.chooserMarketSection.hidden = true;
  els.chooserDialog.showModal();
}

async function openMarketplaceBrowser(uid, { append = false } = {}) {
  if (!uid) return;
  state.chooserUid = uid;
  state.chooserMode = 'marketplace';
  state.chooserAppend = append;

  const content = state.contentByUid.get(uid);
  els.chooserTitle.textContent = content ? `Add an item — ${content.name}` : 'Add an item';
  els.chooserError.textContent = '';
  els.chooserNoItemsMsg.hidden = true;
  els.chooserCreateBtn.hidden = false; // marketplace mode offers Create *and* Buy
  els.chooserSelectMarketplaceBtn.hidden = true;
  els.chooserMarketSection.hidden = false;

  if (!els.chooserDialog.open) els.chooserDialog.showModal();

  await renderChooserMarketplace(uid);
}

// Switch the open chooser dialog (in 'no-items' mode) into 'marketplace' mode.
// Used by the "or select from Marketplace" link inside the no-items prompt and
// also as the body-renderer for openMarketplaceBrowser.
async function renderChooserMarketplace(uid) {
  state.chooserMode = 'marketplace';
  els.chooserNoItemsMsg.hidden = true;
  els.chooserCreateBtn.hidden = false; // Create stays available alongside the buy list
  els.chooserSelectMarketplaceBtn.hidden = true;
  els.chooserMarketSection.hidden = false;

  const content = state.contentByUid.get(uid);
  if (content) els.chooserTitle.textContent = `Add an item — ${content.name}`;

  els.chooserMarketList.innerHTML = `<div class="chooser-loading">Loading…</div>`;
  try {
    const [mine, market] = await Promise.all([
      state.itemsByContent.has(uid)
        ? Promise.resolve(state.itemsByContent.get(uid))
        : fetchItemsForContent(uid),
      state.publicItemsByContent.has(uid)
        ? Promise.resolve(state.publicItemsByContent.get(uid))
        : fetchPublicItemsForContent(uid),
    ]);
    if (state.chooserUid !== uid) return; // dialog moved on
    renderMarketplaceList(uid, mine, market);
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    els.chooserError.textContent = `Couldn't load items: ${err.message}`;
    els.chooserMarketList.innerHTML = '';
  }
}

function renderMarketplaceList(uid, mineItems, marketItems) {
  const myId = state.user?._id;
  const mineIds = new Set(mineItems.map(it => it._id));
  const marketOnly = marketItems.filter(it => !mineIds.has(it._id));

  els.chooserMarketList.innerHTML = marketOnly.length === 0
    ? `<div class="chooser-empty">No public items available for this content.</div>`
    : marketOnly.map(it => chooserRowHtml(uid, it, myId)).join('');

  els.chooserDialog.querySelectorAll('.chooser-row').forEach(row => {
    row.addEventListener('click', () => {
      const itemId = row.dataset.itemId;
      const item = marketItems.find(x => x._id === itemId);
      if (item) purchaseAndUse(item);
    });
  });
}

async function purchaseAndUse(item) {
  els.chooserError.textContent = '';
  const price = Number(item.price) || 0;
  const balance = Number(state.user?.walletBalance) || 0;

  if (price > balance) {
    els.chooserError.textContent = `Not enough balance — wallet €${balance.toFixed(2)}, price €${price.toFixed(2)}.`;
    return;
  }

  const creator = item.creatorId?.username || 'unknown';
  const audLabel = item.targetAudience ? ` (${item.targetAudience})` : '';
  const promptMsg = price > 0
    ? `Buy this item${audLabel} by ${creator} for €${price.toFixed(2)}?`
    : `Add this free item${audLabel} by ${creator} to your collection?`;
  if (!window.confirm(promptMsg)) return;

  try {
    await api(`/items/${item._id}/purchase`, { method: 'POST' });
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    els.chooserError.textContent = err.message || 'Purchase failed.';
    return;
  }

  // Reflect ownership locally so future chooser opens see the item in
  // "From your collection" instead of the marketplace section.
  if (!Array.isArray(state.user.purchasedItems)) state.user.purchasedItems = [];
  state.user.purchasedItems.push(item._id);
  if (price > 0) {
    state.user.walletBalance = Math.max(0, balance - price);
  }

  const uid = state.chooserUid;
  if (uid) {
    const cached = state.itemsByContent.get(uid) || [];
    if (!cached.find(x => x._id === item._id)) {
      state.itemsByContent.set(uid, [item, ...cached]);
    }
  }

  if (state.chooserAppend && state.selected) {
    // appendItemToSequence closes the chooser.
    appendItemToSequence(item);
  } else {
    // No append (Buy from Marketplace inside an expanded seq-card, or Add Items
    // grid's "or select from Marketplace") — just close.
    closeContentChooser();
    // Re-render the editor in case the user is buying a second item for an already-
    // open seq-card; the new item should appear in the item list (unselected).
    if (state.tab === 'my-visits') renderEditor();
  }
}

function chooserRowHtml(uid, item, myId) {
  const creator = item.creatorId?.username || '—';
  const aud = item.targetAudience || '—';
  const tones = (item.descriptions || []).map(d => d.tone).join(', ') || '—';
  const isMine = (item.creatorId?._id || item.creatorId) === myId;
  const tag = isMine ? '<span class="chooser-tag mine">yours</span>' : '';
  const price = item.price > 0 ? `<span class="chooser-price">${item.price}€</span>` : '';
  return `
    <button type="button" class="chooser-row" data-item-id="${escapeAttr(item._id)}">
      <span class="chooser-row-aud">${escapeHtml(aud)}</span>
      <span class="chooser-row-creator">${escapeHtml(creator)} ${tag}</span>
      <span class="chooser-row-tones">${escapeHtml(tones)}</span>
      ${price}
    </button>
  `;
}

function appendItemToSequence(item) {
  if (!state.selected) return;

  state.selected.sequence = [
    ...(state.selected.sequence || []),
    { itemId: item, prevDirections: '', nextDirections: '' },
  ];
  // Auto-expand the newly added entry so the user sees it landed.
  state.selectedExpanded = new Set([state.selected.sequence.length - 1]);
  markDirty();
  closeContentChooser();
  renderEditor();
  renderContentPicker(); // hide the just-added content from the right column
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
      <button type="button" class="ci-create" data-uid="${escapeAttr(c.universalId || '')}">Create Item</button>
      <button type="button" class="ci-marketplace" data-uid="${escapeAttr(c.universalId || '')}">or select from Marketplace</button>
    </div>
  `).join('');

  els.contentGrid.querySelectorAll('.ci-create').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.uid;
      if (uid) openCreateItemDialog(uid, 'add-items');
    });
  });

  els.contentGrid.querySelectorAll('.ci-marketplace').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.uid;
      if (uid) openMarketplaceBrowser(uid, { append: false });
    });
  });
}

/* ---------- Create / Edit Item dialog ----------
 *
 * Modes:
 *   'create'  — POST /items, returns item; the chooser-context ('chooser') flow appends
 *               the new item onto the active visit's sequence.
 *   'edit'    — PUT /items/:id (state.editItem._id), pre-fills the form with the
 *               existing item's first description block. Update only — never appends.
 */

function openCreateItemDialog(uid, context, options = {}) {
  if (!uid) return;
  const content = state.contentByUid.get(uid);
  if (!content) return;

  const editItem = options.editItem || null;
  state.createItemUid = uid;
  state.createItemContext = context;
  state.createItemMode = editItem ? 'edit' : 'create';
  state.editItem = editItem;

  const verb = editItem ? 'Edit' : 'Create';
  els.createItemTitle.textContent = `${verb} Item — ${content.name}`;
  els.createItemThumb.innerHTML = content.imageUrl
    ? `<img src="${escapeAttr(content.imageUrl)}" alt="" loading="lazy" />`
    : `<span class="ph">No image</span>`;
  els.createItemId.textContent = content.universalId || '—';
  els.createItemType.textContent = content.type || '—';
  els.createItemContentName.textContent = content.name || '—';
  els.createItemAuthor.textContent = content.author || '—';

  const f = els.createItemForm;
  f.reset();
  els.createItemError.textContent = '';
  els.createItemSaveBtn.disabled = false;
  els.createItemSaveBtn.textContent = editItem ? 'Save changes' : 'Publish';

  // One texts-bucket per tone. The three textareas are a *view* onto whichever
  // bucket the active tone tab points at; all three buckets are published together.
  state.createItemTexts = blankToneTexts();
  state.createItemTone = 'easy';

  if (editItem) {
    // Pre-fill every tone block the item already has. Items authored before tones
    // became mandatory may carry only one block — the missing tones stay blank and
    // the user has to fill them before the item can be saved.
    for (const desc of editItem.descriptions || []) {
      if (!TONES.includes(desc.tone)) continue;
      for (const t of desc.texts || []) {
        if (t.lengthCategory in state.createItemTexts[desc.tone]) {
          state.createItemTexts[desc.tone][t.lengthCategory] = t.text || '';
        }
      }
    }
    f.elements.namedItem('targetAudience').value = editItem.targetAudience || '';
    f.elements.namedItem('isPublic').checked = !!editItem.isPublic;
    f.elements.namedItem('price').value = editItem.price ?? 0;
  }

  loadToneIntoTextareas();
  renderToneTabs();

  els.createItemDialog.showModal();
  f.elements.namedItem('targetAudience').focus();
}

const TONES = ['easy', 'medium', 'complex'];
const LENGTH_FIELDS = [
  { key: '3s',  field: 'text3s'  },
  { key: '15s', field: 'text15s' },
  { key: '45s', field: 'text45s' },
];

function blankToneTexts() {
  return {
    easy:    { '3s': '', '15s': '', '45s': '' },
    medium:  { '3s': '', '15s': '', '45s': '' },
    complex: { '3s': '', '15s': '', '45s': '' },
  };
}

/* Copy the three textareas into the active tone's bucket. Must run before any
 * tab switch or submit, otherwise the tone being edited is silently discarded. */
function stashTextareasIntoTone() {
  if (!state.createItemTexts) return;
  const f = els.createItemForm;
  const bucket = state.createItemTexts[state.createItemTone];
  for (const { key, field } of LENGTH_FIELDS) {
    bucket[key] = f.elements.namedItem(field).value;
  }
}

function loadToneIntoTextareas() {
  if (!state.createItemTexts) return;
  const f = els.createItemForm;
  const bucket = state.createItemTexts[state.createItemTone];
  for (const { key, field } of LENGTH_FIELDS) {
    f.elements.namedItem(field).value = bucket[key] || '';
  }
}

function toneIsComplete(tone) {
  const bucket = state.createItemTexts?.[tone];
  if (!bucket) return false;
  return LENGTH_FIELDS.every(({ key }) => (bucket[key] || '').trim() !== '');
}

function renderToneTabs() {
  els.createItemToneTabs.querySelectorAll('.ci-tone-tab').forEach(tab => {
    const tone = tab.dataset.tone;
    const active = tone === state.createItemTone;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
    // Dot marker so the user can see which tones still need text without
    // clicking through all three.
    tab.classList.toggle('is-complete', toneIsComplete(tone));
  });
}

function switchTone(tone) {
  if (!TONES.includes(tone) || tone === state.createItemTone) return;
  stashTextareasIntoTone();
  state.createItemTone = tone;
  loadToneIntoTextareas();
  renderToneTabs();
}

/* First empty cell of the 3 tones × 3 lengths matrix, in tone-then-length order,
 * or null when the item is complete. Drives the submit-time error message. */
function findFirstMissingText() {
  for (const tone of TONES) {
    for (const { key, field } of LENGTH_FIELDS) {
      if ((state.createItemTexts[tone][key] || '').trim() === '') {
        return { tone, length: key, field };
      }
    }
  }
  return null;
}

function closeCreateItemDialog() {
  els.createItemDialog.close();
  state.createItemUid = null;
  state.createItemContext = null;
  state.createItemMode = 'create';
  state.createItemTone = 'easy';
  state.createItemTexts = null;
  state.editItem = null;
}

async function handleCreateItemSubmit(e) {
  e.preventDefault();
  els.createItemError.textContent = '';

  const f = els.createItemForm;
  if (!f.checkValidity()) {
    f.reportValidity();
    return;
  }

  // The visible textareas only hold the active tone — fold them back in before reading.
  stashTextareasIntoTone();
  renderToneTabs();

  const data = new FormData(f);
  const targetAudience = (data.get('targetAudience') || '').trim();
  const isPublic = f.elements.namedItem('isPublic').checked;
  const price = Math.max(0, Number(data.get('price')) || 0);

  // Every tone × every length is mandatory: an item is published with the full
  // 3×3 matrix so the Navigator's Describe! progression works for any tone.
  const firstGap = findFirstMissingText();
  if (firstGap) {
    if (firstGap.tone !== state.createItemTone) {
      state.createItemTone = firstGap.tone;
      loadToneIntoTextareas();
      renderToneTabs();
    }
    els.createItemError.textContent =
      `Fill the ${firstGap.length} description for the "${firstGap.tone}" tone — all three tones are required.`;
    f.elements.namedItem(firstGap.field).focus();
    return;
  }

  const descriptions = TONES.map(tone => ({
    tone,
    texts: LENGTH_FIELDS.map(({ key }) => ({
      text: state.createItemTexts[tone][key].trim(),
      lengthCategory: key,
      language: 'it',
    })),
  }));

  const isEdit = state.createItemMode === 'edit' && state.editItem;
  const baseLabel = isEdit ? 'Save changes' : 'Publish';
  els.createItemSaveBtn.disabled = true;
  els.createItemSaveBtn.textContent = isEdit ? 'Saving…' : 'Publishing…';

  try {
    let saved;
    if (isEdit) {
      const payload = {
        targetAudience,
        descriptions,
        price,
        isPublic,
      };
      saved = (await api(`/items/${state.editItem._id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })).item;
    } else {
      const payload = {
        contentId: state.createItemUid,
        targetAudience,
        descriptions,
        price,
        isPublic,
      };
      saved = (await api('/items', {
        method: 'POST',
        body: JSON.stringify(payload),
      })).item;
    }

    // Both POST /items and PUT /items/:id return the unpopulated doc — creatorId is
    // an ObjectId string. Normalize it to {_id, username} (matching the populated
    // shape used elsewhere) so seq-card rendering and chooser rows work.
    if (state.user && typeof saved.creatorId === 'string') {
      saved.creatorId = { _id: state.user._id, username: state.user.username };
    }

    const uid = state.createItemUid;
    const cached = state.itemsByContent.get(uid) || [];
    if (isEdit) {
      // Replace by id, preserving order.
      state.itemsByContent.set(uid, cached.map(it => it._id === saved._id ? saved : it));
      // The visit's sequence may reference this item; if so, swap in the updated copy
      // so subsequent renders show the new tones/audience/price.
      if (state.selected?.sequence) {
        state.selected.sequence = state.selected.sequence.map(entry => {
          if (entry.itemId && entry.itemId._id === saved._id) {
            return { ...entry, itemId: saved };
          }
          return entry;
        });
      }
    } else {
      state.itemsByContent.set(uid, [saved, ...cached]);
    }

    // Public-items cache may now be stale; drop it so the marketplace section refetches.
    if (saved.isPublic || (isEdit && state.editItem?.isPublic)) {
      state.publicItemsByContent.delete(uid);
    }

    const context = state.createItemContext;
    closeCreateItemDialog();

    if (!isEdit && context === 'chooser' && state.chooserAppend && state.selected) {
      // Right-column "+" → no-items prompt → Create Item: append the freshly-created
      // item to the active visit. appendItemToSequence closes the chooser dialog under us.
      appendItemToSequence(saved);
    } else {
      // Any other chooser create (notably "Create Item or buy from Marketplace" inside
      // an expanded seq-card, where the content is *already* in the visit) must not
      // append — that would duplicate the sequence entry. Just close the chooser; the
      // new item shows up in the entry's radio list, unselected.
      if (context === 'chooser') closeContentChooser();
      // Edits / add-items context: re-render so seq-card bodies pick up the change.
      if (state.tab === 'my-visits') renderEditor();
    }
  } catch (err) {
    if (err.status === 401) { logout(); return; }
    els.createItemError.textContent = err.message || 'Failed to save item.';
    els.createItemSaveBtn.disabled = false;
    els.createItemSaveBtn.textContent = baseLabel;
  }
}

/* ---------- View Item dialog ----------
 *
 * Shown when the user clicks "View Item" in an expanded seq-card body. Pulls the
 * item from `state.itemsByContent` if cached, otherwise GETs it. Shows metadata +
 * descriptions (tone × length-text). For items the user authored, also exposes
 * Edit (opens Create Item dialog in 'edit' mode) and Delete.
 */

async function openViewItemDialog(itemId) {
  if (!itemId) return;
  state.viewItemId = itemId;

  // Try the local cache (across all contents) first to avoid a roundtrip.
  let item = findCachedItem(itemId);
  if (!item) {
    try {
      item = (await api(`/items/${itemId}`)).item;
    } catch (err) {
      if (err.status === 401) { logout(); return; }
      els.viewItemError.textContent = `Couldn't load item: ${err.message}`;
      els.viewItemDialog.showModal();
      return;
    }
  }

  if (state.viewItemId !== itemId) return; // user moved on

  renderViewItem(item);
  els.viewItemDialog.showModal();
}

function findCachedItem(itemId) {
  for (const items of state.itemsByContent.values()) {
    const found = items.find(it => it._id === itemId);
    if (found) return found;
  }
  for (const items of state.publicItemsByContent.values()) {
    const found = items.find(it => it._id === itemId);
    if (found) return found;
  }
  return null;
}

function renderViewItem(item) {
  const content = state.contentByUid.get(item.contentId);
  const myId = state.user?._id;
  const creatorId = item.creatorId?._id || item.creatorId;
  const isMine = creatorId === myId;

  els.viewItemTitle.textContent = content ? content.name : 'Item details';
  els.viewItemContent.textContent = content ? `${content.name}${content.author ? ' — ' + content.author : ''}` : (item.contentId || '—');
  els.viewItemAud.textContent = item.targetAudience || '—';
  els.viewItemCreator.textContent = (item.creatorId?.username) || (isMine ? state.user?.username : '—');
  els.viewItemLicense.textContent = item.license || '—';
  els.viewItemPublic.textContent = item.isPublic ? 'Public' : 'Private';
  els.viewItemPrice.textContent = (item.price > 0) ? `€${Number(item.price).toFixed(2)}` : 'Free';
  els.viewItemError.textContent = '';

  // Render description blocks: one section per tone, with each length-text inside.
  const descs = item.descriptions || [];
  els.viewItemDescriptions.innerHTML = descs.length === 0
    ? `<div class="view-item-empty">No descriptions.</div>`
    : descs.map(d => `
        <article class="view-item-desc">
          <h4>${escapeHtml(d.tone || '—')}</h4>
          <ul>
            ${(d.texts || []).map(t => `
              <li>
                <span class="view-item-desc-len">${escapeHtml(t.lengthCategory || '—')}</span>
                <span class="view-item-desc-text">${escapeHtml(t.text || '')}</span>
              </li>
            `).join('')}
          </ul>
        </article>
      `).join('');

  els.viewItemEditBtn.hidden = !isMine;
  els.viewItemDeleteBtn.hidden = !isMine;
}

function closeViewItemDialog() {
  els.viewItemDialog.close();
  state.viewItemId = null;
}

function startEditFromViewItem() {
  const itemId = state.viewItemId;
  if (!itemId) return;
  const item = findCachedItem(itemId);
  if (!item) return;
  closeViewItemDialog();
  openCreateItemDialog(item.contentId, 'view-item', { editItem: item });
}

async function deleteFromViewItem() {
  const itemId = state.viewItemId;
  if (!itemId) return;
  const item = findCachedItem(itemId);
  if (!item) return;

  const ok = window.confirm(`Delete this item? This cannot be undone.\n\n${item.targetAudience || ''}`);
  if (!ok) return;

  els.viewItemDeleteBtn.disabled = true;
  try {
    await api(`/items/${itemId}`, { method: 'DELETE' });
  } catch (err) {
    els.viewItemDeleteBtn.disabled = false;
    if (err.status === 401) { logout(); return; }
    els.viewItemError.textContent = err.message || 'Delete failed.';
    return;
  }

  // Drop the item from every cache.
  const uid = item.contentId;
  const owned = state.itemsByContent.get(uid);
  if (owned) state.itemsByContent.set(uid, owned.filter(it => it._id !== itemId));
  const pub = state.publicItemsByContent.get(uid);
  if (pub) state.publicItemsByContent.set(uid, pub.filter(it => it._id !== itemId));

  // If the visit's sequence references this item, the entry now points to a
  // missing item — Mongoose populate will return null. Leave it as-is so the
  // user can decide (Remove from visit / pick a different item by re-adding).
  // The seq-card will render `<em>Item missing.</em>` until the user reloads
  // or the entry is removed.

  els.viewItemDeleteBtn.disabled = false;
  closeViewItemDialog();
  if (state.tab === 'my-visits') renderEditor();
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
  // Use full render: create-mode flips state.selected from null/old → draft,
  // which changes the content-picker `+` enabled state.
  render();
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
  // Full render: state.selected may have flipped to null (no visits remain),
  // which disables the content-picker `+`.
  render();
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
  window.location.replace('/marketplace-fede-old');
} else {
  init();
}
