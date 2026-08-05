const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token");
const CONTENT_PLACEHOLDER = "/uploads/contents/placeholder.jpg";

if (!token) {
    alert("You must be logged in to access this page.");
    window.location.href = "../pages/login.html";
}

const urlParams = new URLSearchParams(window.location.search);
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName') || 'Museo';
const visitId = urlParams.get('visitId'); 
const STRUCTURE_TAG = "[Struttura Blocchi Salvata: ";

// Diamo "memoria" al pulsante Back to Museum page
const backToMuseumBtn = document.getElementById('back-to-museum-btn');
if (backToMuseumBtn) {
    // Aggiorniamo l'href dinamicamente inserendo l'ID che abbiamo appena letto
    backToMuseumBtn.href = `visits_list.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
}

const displayMuseumEl = document.getElementById('display-museum-name');
if (displayMuseumEl) displayMuseumEl.innerText = museumName || "No museums";

// --- LOGICA MODALE ANNULLA / ESCI ---
const cancelModal = document.getElementById('cancel-confirm-modal');
document.getElementById('cancel-btn').addEventListener('click', () => {
    cancelModal.classList.remove('hidden');
});
document.getElementById('confirm-exit-btn').addEventListener('click', () => {
    window.location.href = `visits_list.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
});
document.getElementById('confirm-save-btn').addEventListener('click', () => {
    cancelModal.classList.add('hidden');
    document.getElementById('save-visit-btn').click(); 
});
document.getElementById('close-cancel-modal').addEventListener('click', () => {
    cancelModal.classList.add('hidden');
});

const itemModal = document.getElementById('select-item-modal');
const itemsContainer = document.getElementById('items-container');
const walletCurrentEl = document.getElementById('visit-wallet-current');
const walletPendingEl = document.getElementById('visit-wallet-pending');
const walletRemainingEl = document.getElementById('visit-wallet-remaining');
const visitVisibilityInput = document.getElementById('v-is-public');
const visitVisibilityStatus = document.getElementById('visit-visibility-status');
const visitVisibilityHint = document.getElementById('visit-visibility-hint');
let activeBlockList = null; 
let currentWalletBalance = 0;
let itemCatalog = {};
let museumContentsCache = [];
let originalVisitItemCounts = {};

if (visitVisibilityInput) {
    visitVisibilityInput.addEventListener('change', () => {
        setVisitVisibility(visitVisibilityInput.checked);
    });
    setVisitVisibility(false);
}

// Funzione Numeri Romani
function toRoman(num) { 
    const roman = {M:1000, CM:900, D:500, CD:400, C:100, XC:90, L:50, XL:40, X:10, IX:9, V:5, IV:4, I:1};
    let str = '';
    for (let i of Object.keys(roman)) {
        let q = Math.floor(num / roman[i]);
        num -= q * roman[i];
        str += i.repeat(q);
    }
    return str;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function resolveAssetUrl(path) {
    if (!path) return "";
    return path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

function contentImagePath(content) {
    return content?.imgPath || content?.imageUrl || CONTENT_PLACEHOLDER;
}

function renderBuilderMessage(message, isError = false) {
    return `<p class="builder-empty-message${isError ? ' error-text' : ''}">${escapeHTML(message)}</p>`;
}

function setVisitVisibility(isPublic) {
    if (visitVisibilityInput) {
        visitVisibilityInput.checked = Boolean(isPublic);
    }

    if (visitVisibilityStatus) {
        visitVisibilityStatus.textContent = isPublic ? "Pubblica" : "Privata";
    }

    if (visitVisibilityHint) {
        visitVisibilityHint.textContent = isPublic
            ? "Visibile nella lista pubblica del museo"
            : "Visibile solo dal tuo account";
    }
}

function getVisitVisibility() {
    return Boolean(visitVisibilityInput?.checked);
}

function formatCurrencyAmount(value) {
    const numericValue = Number(value) || 0;
    return Number.isInteger(numericValue) ? `${numericValue} Aα` : `${numericValue.toFixed(2)} Aα`;
}

async function loadWalletBalance() {
    try {
        const res = await fetch(`${myApi}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Wallet request failed");

        const data = await res.json();
        const user = data.user || data;
        currentWalletBalance = Number(user.walletBalance) || 0;
        updateWalletPreview();
    } catch (error) {
        console.error("Errore nel recupero del saldo utente:", error);
        currentWalletBalance = 0;
        updateWalletPreview();
    }
}

function countVisitItemsFromDom() {
    return Array.from(document.querySelectorAll('.draggable-item')).reduce((counts, itemNode) => {
        const itemId = itemNode.dataset.itemId;
        if (!itemId) return counts;
        counts[itemId] = (counts[itemId] || 0) + 1;
        return counts;
    }, {});
}

function calculatePendingVisitCost() {
    const currentCounts = countVisitItemsFromDom();
    let total = 0;

    Object.entries(currentCounts).forEach(([itemId, currentCount]) => {
        const previousCount = originalVisitItemCounts[itemId] || 0;
        const extraCount = currentCount - previousCount;

        if (extraCount > 0) {
            const itemPrice = Number(itemCatalog[itemId]?.price) || 0;
            total += itemPrice * extraCount;
        }
    });

    return total;
}

function updateWalletPreview() {
    const pendingCost = calculatePendingVisitCost();
    const remainingBalance = currentWalletBalance - pendingCost;

    if (walletCurrentEl) walletCurrentEl.textContent = formatCurrencyAmount(currentWalletBalance);
    if (walletPendingEl) walletPendingEl.textContent = formatCurrencyAmount(pendingCost);
    if (walletRemainingEl) {
        walletRemainingEl.textContent = formatCurrencyAmount(remainingBalance);
        walletRemainingEl.classList.toggle('is-warning', remainingBalance < 0);
    }
}

function canAffordItemAddition(itemId) {
    const itemPrice = Number(itemCatalog[itemId]?.price) || 0;
    const remainingBalance = currentWalletBalance - calculatePendingVisitCost();
    return itemPrice <= remainingBalance;
}

function refreshModalItemAvailability() {
    const remainingBalance = currentWalletBalance - calculatePendingVisitCost();

    Array.from(itemsContainer.querySelectorAll('.modal-artwork-item')).forEach((button) => {
        const itemId = button.dataset.itemId;
        const itemPrice = Number(itemCatalog[itemId]?.price) || 0;
        const canAfford = itemPrice <= remainingBalance;

        button.disabled = !canAfford;
        button.title = canAfford ? "Add artwork" : "Saldo insufficiente";
    });

    updateWalletPreview();
}

async function loadMuseumItemCatalog(forceReload = false) {
    if (!forceReload && Object.keys(itemCatalog).length > 0 && museumContentsCache.length > 0) {
        return itemCatalog;
    }

    const headers = { 'Authorization': `Bearer ${token}` };
    const [contentsRes, itemsRes] = await Promise.all([
        fetch(`${myApi}/museums/${museumId}/contents`, { headers }),
        fetch(`${myApi}/items`, { headers })
    ]);

    if (!contentsRes.ok || !itemsRes.ok) {
        throw new Error("Impossibile caricare catalogo opere");
    }

    const contentsData = await contentsRes.json();
    const itemsData = await itemsRes.json();
    const museumContents = contentsData.contents || [];
    const allItems = itemsData.items || [];

    museumContentsCache = museumContents;

    const validContentIds = new Set();
    museumContents.forEach((content) => {
        if (content.universalId) validContentIds.add(content.universalId);
        validContentIds.add(content._id.toString());
    });

    itemCatalog = {};
    allItems
        .filter((item) => validContentIds.has(item.contentId))
        .forEach((item) => {
            itemCatalog[item._id] = createItemInfo(item, museumContents);
        });

    return itemCatalog;
}

const blocksContainer = document.getElementById('blocks-container');
const addBlockBtnWrapper = document.getElementById('add-block-btn');
let blockCounter = 0;

function createNewBlock(defaultTitle = "New Section") {
    blockCounter++;
    const block = document.createElement('div');
    block.className = 'visit-block';
    block.innerHTML = `
        <div class="block-header">
            <span class="block-number">${toRoman(blockCounter)}</span>
            <input type="text" class="block-title-input" value="${escapeHTML(defaultTitle)}">
            <span class="block-count">0 artworks</span>
            <button class="delete-block-btn" title="Remove section" aria-label="Remove section">&times;</button>
        </div>
        <ul class="block-list"></ul>
        <div class="block-footer">
            <button class="add-btn add-item-to-block" type="button" title="Add an artwork to this section">+</button>
        </div>
    `;

    const ulList = block.querySelector('.block-list');
    
    block.querySelector('.add-item-to-block').addEventListener('click', () => {
        activeBlockList = ulList; 
        apriModaleOpere();
    });

    block.querySelector('.delete-block-btn').addEventListener('click', () => {
        if(confirm("Do you really want to delete this column? All the artworks will be removed too..")) {
            block.remove();
            aggiornaContatoriBlocchi();
        }
    });

    setupDragAndDropForList(ulList);
    blocksContainer.insertBefore(block, addBlockBtnWrapper);
    aggiornaContatoriBlocchi();
}

addBlockBtnWrapper.addEventListener('click', () => {
    createNewBlock("New Section");
});

// --- LOGICA ESPANSIONE CARTE ARCHIDEKT ---
function aggiornaStatoCarte() {
    document.querySelectorAll('.block-list').forEach(list => {
        const items = Array.from(list.children);
        
        items.forEach(item => {
            if (item.classList) item.classList.remove('is-last-item');
        });
        
        const validItems = items.filter(item => 
            item.classList.contains('draggable-item') && !item.classList.contains('dragging')
        );
        
        if (validItems.length > 0) {
            const lastChild = items[items.length - 1];
            if (!lastChild.classList.contains('placeholder')) {
                validItems[validItems.length - 1].classList.add('is-last-item');
            }
        }
    });
}

function aggiornaContatoriBlocchi() {
    const blocks = document.querySelectorAll('.visit-block');
    blocks.forEach((block, index) => {
        block.querySelector('.block-number').textContent = toRoman(index + 1);
        const itemCount = block.querySelectorAll('.draggable-item').length;
        block.querySelector('.block-count').textContent = `${itemCount} artworks`;
    });
    aggiornaStatoCarte(); 
    updateWalletPreview();
    refreshModalItemAvailability();
}

// --- LOGICA RECUPERO OPERE ED INCROCIO CON I CONTENTS ---
async function apriModaleOpere() {
    itemModal.classList.remove('hidden');
    itemsContainer.innerHTML = renderBuilderMessage("Loading from server...");
    updateWalletPreview();

    try {
        const catalog = await loadMuseumItemCatalog(true);
        const museumItems = Object.entries(catalog);

        itemsContainer.innerHTML = '';
        if (museumItems.length > 0) {
            museumItems.forEach(([itemId, itemInfo]) => {
                const itemDiv = document.createElement('button');
                itemDiv.type = 'button';
                itemDiv.className = 'modal-artwork-item';
                itemDiv.dataset.itemId = itemId;
                const itemPrice = Number(itemInfo.price) || 0;
                const priceLabel = itemPrice > 0 ? formatCurrencyAmount(itemPrice) : 'Free';

                const finalImgUrl = resolveAssetUrl(itemInfo.imageUrl);
                const imgTag = finalImgUrl
                    ? `<img src="${escapeHTML(finalImgUrl)}" alt="${escapeHTML(itemInfo.title)}" class="modal-artwork-image">`
                    : '<span class="image-fallback">IMG</span>';

                itemDiv.innerHTML = `
                    <div class="modal-artwork-row">
                        <div class="modal-artwork-thumb">${imgTag}</div>
                        <span class="modal-artwork-copy">
                            <strong>${escapeHTML(itemInfo.title)}</strong>
                            <small>${escapeHTML(itemInfo.author)}</small>
                        </span>
                        <span class="modal-artwork-price">${escapeHTML(priceLabel)}</span>
                    </div>
                    <div class="modal-artwork-preview">
                        <div class="modal-artwork-preview-frame">${imgTag}</div>
                    </div>
                `;

                itemDiv.querySelectorAll('.modal-artwork-image').forEach((img) => {
                    img.addEventListener('error', () => img.classList.add('is-hidden'));
                });

                itemDiv.disabled = !canAffordItemAddition(itemId);

                itemDiv.onclick = () => {
                    creaEdAggiungiItem(
                        itemInfo.title,
                        itemId,
                        activeBlockList,
                        itemInfo.imageUrl,
                        itemInfo.author,
                        itemInfo.contentId
                    );
                    itemModal.classList.add('hidden');
                };
                itemsContainer.appendChild(itemDiv);
            });
            refreshModalItemAvailability();
        } else {
            itemsContainer.innerHTML = renderBuilderMessage("No artworks found.");
        }
    } catch (err) {
        itemsContainer.innerHTML = renderBuilderMessage("Connection error.", true);
    }
}

document.getElementById('close-item-modal').addEventListener('click', () => itemModal.classList.add('hidden'));

// --- DRAG & DROP INCROCIATO & CREAZIONE CARTA ---
let draggedItem = null;
let placeholder = document.createElement('li');
placeholder.className = 'placeholder';

function creaEdAggiungiItem(titoloOpera, itemId, targetList, imageUrl = null, author = "Autore Ignoto", contentId = "") {
    const li = document.createElement('li');
    li.classList.add('draggable-item');
    li.setAttribute('draggable', 'true');
    li.setAttribute('tabindex', '0');
    li.dataset.itemId = itemId; 
    li.dataset.title = titoloOpera || "";
    li.dataset.author = author || "";
    li.dataset.imageUrl = imageUrl || "";
    li.dataset.contentId = contentId || "";

    // Risolviamo il percorso dell'immagine
    const finalImgUrl = resolveAssetUrl(imageUrl);
    const imgTag = finalImgUrl
        ? `<img src="${escapeHTML(finalImgUrl)}" alt="${escapeHTML(titoloOpera)}" class="draggable-item-image">`
        : '<span class="image-fallback">IMG</span>';

    const priceInfo = itemCatalog[itemId];
    const priceValue = Number(priceInfo?.price) || 0;
    const priceLabel = priceValue > 0 ? `${priceValue} Aα` : 'Free';
    const priceClass = priceValue > 0 ? 'is-paid' : 'is-free';

    li.innerHTML = `
        <div class="card-header">
            <button type="button" class="drag-handle" title="Trascina per riordinare" aria-label="Trascina per riordinare">
                <span class="drag-handle-dots" aria-hidden="true">
                    <span></span><span></span><span></span><span></span><span></span><span></span>
                </span>
            </button>
            <div class="card-thumb">${imgTag}</div>
            <div class="card-title-block">
                <strong class="card-title">${escapeHTML(titoloOpera)}</strong>
                <div class="card-meta-row">
                    <span class="meta-pill meta-pill-author">${escapeHTML(author)}</span>
                    <span class="meta-pill meta-pill-price ${priceClass}">${escapeHTML(priceLabel)}</span>
                </div>
            </div>
            <button class="delete-btn" title="Rimuovi opera" aria-label="Rimuovi opera">&times;</button>
        </div>
        <div class="card-details">
            <div class="card-image-placeholder">
                ${imgTag}
            </div>
            <div class="card-copy">
                <p class="card-author"><strong>${escapeHTML(author)}</strong></p>
                <p class="card-note">Click to edit this artwork's texts.</p>
            </div>
        </div>
    `;

    const itemImages = li.querySelectorAll('.draggable-item-image');
    itemImages.forEach((img) => {
        img.addEventListener('error', () => img.classList.add('is-hidden'));
    });

    li.addEventListener('click', function(e) {
        if(e.target.closest('.delete-btn') || e.target.closest('.drag-handle')) {
            return;
        }
        salvaStatoTemporaneo();
        
        const params = new URLSearchParams({
            itemId: itemId,
            museumId: museumId,
            museumName: museumName,
            title: titoloOpera,
            author: author || "Autore Ignoto",
            image: imageUrl || ''
        });
        if (visitId) params.set('visitId', visitId);
        if (contentId) params.set('contentId', contentId);
        window.location.href = `create_items.html?${params.toString()}`;
    });

    li.addEventListener('keydown', function(e) {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.delete-btn') && !e.target.closest('.drag-handle')) {
            e.preventDefault();
            li.click();
        }
    });

    li.querySelector('.delete-btn').addEventListener('click', () => {
        li.remove();
        aggiornaContatoriBlocchi();
    });

    li.addEventListener('dragstart', function(e) {
        draggedItem = this;
        placeholder.style.height = `${this.offsetHeight}px`;
        setTimeout(() => {
            this.classList.add('dragging');
            this.parentNode.insertBefore(placeholder, this.nextSibling);
            aggiornaContatoriBlocchi(); 
        }, 0);
    });

    li.addEventListener('dragend', function() {
        this.classList.remove('dragging');
        if (placeholder.parentNode) {
            placeholder.parentNode.insertBefore(this, placeholder);
            placeholder.parentNode.removeChild(placeholder);
        }
        draggedItem = null;
        aggiornaContatoriBlocchi(); 
    });

    targetList.appendChild(li);
    aggiornaContatoriBlocchi();
}

function setupDragAndDropForList(listElement) {
    listElement.addEventListener('dragover', function(e) {
        e.preventDefault(); 
        if (!draggedItem) return;

        const afterElement = getDragAfterElement(listElement, e.clientY);
        if (afterElement == null) {
            listElement.appendChild(placeholder);
        } else {
            listElement.insertBefore(placeholder, afterElement);
        }
        
        aggiornaStatoCarte(); 
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// --- SALVATAGGIO E RIPRISTINO DELLO STATO NEL SESSION STORAGE ---
function salvaStatoTemporaneo() {
    const title = document.getElementById('v-title') ? document.getElementById('v-title').value : '';
    const desc = document.getElementById('v-desc') ? document.getElementById('v-desc').value : '';
    
    const blocksHtmlNodes = Array.from(document.getElementById('blocks-container').children).filter(el => el.id !== 'add-block-btn');
    const blocksHtml = blocksHtmlNodes.map(el => el.outerHTML).join('');
    
    const visitState = {
        title: title,
        desc: desc,
        isPublic: getVisitVisibility(),
        blocks: blocksHtml,
        blockCounter: blockCounter,
        museumId: museumId,
        visitId: visitId || null
    };
    sessionStorage.setItem('temp_visit_state', JSON.stringify(visitState));
}

function getItemIdFromValue(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value._id || value.id || "";
}

function getItemIdFromSequenceEntry(entry) {
    return getItemIdFromValue(entry?.itemId || entry);
}

function getCleanVisitDescription(description = "") {
    const markerIndex = description.indexOf(STRUCTURE_TAG);
    if (markerIndex === -1) return description;
    return description.slice(0, markerIndex).trim();
}

function parseLegacyBlocksFromDescription(description = "") {
    const markerIndex = description.indexOf(STRUCTURE_TAG);
    if (markerIndex === -1) return null;

    const legacyPayload = description.slice(markerIndex + STRUCTURE_TAG.length).trim();
    const jsonString = legacyPayload.endsWith("]") ? legacyPayload.slice(0, -1) : legacyPayload;

    try {
        const parsedBlocks = JSON.parse(jsonString);
        return Array.isArray(parsedBlocks) ? parsedBlocks : null;
    } catch (error) {
        console.error("La struttura salvata nella descrizione non e' valida:", error);
        return null;
    }
}

function normalizeVisitBlocks(visit) {
    const savedBlocks = Array.isArray(visit.blocks) && visit.blocks.length > 0
        ? visit.blocks
        : parseLegacyBlocksFromDescription(visit.description || "");

    if (Array.isArray(savedBlocks) && savedBlocks.length > 0) {
        return savedBlocks.map((block, index) => ({
            blockName: block.blockName || block.title || `Section ${index + 1}`,
            items: (block.items || []).map(getItemIdFromValue).filter(Boolean)
        }));
    }

    const sequence = Array.isArray(visit.sequence) ? [...visit.sequence] : [];
    const sequenceItems = sequence
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(getItemIdFromSequenceEntry)
        .filter(Boolean);

    return sequenceItems.length > 0
        ? [{ blockName: "Mainboard", items: sequenceItems }]
        : [];
}

function getItemTitle(item, relatedContent) {
    return item?.descriptions?.[0]?.title || relatedContent?.name || "Opera";
}

function createItemInfo(item, museumContents) {
    const relatedContent = museumContents.find(c => c.universalId === item.contentId || c._id?.toString() === item.contentId);

    return {
        title: getItemTitle(item, relatedContent),
        author: relatedContent?.author || "Autore Ignoto",
        imageUrl: contentImagePath(relatedContent),
        contentId: item.contentId || "",
        price: Number(item.price) || 0
    };
}

function addVisitSequenceItemsToMap(itemMap, visit, museumContents) {
    (visit.sequence || []).forEach(sequenceItem => {
        const item = sequenceItem.itemId;
        const itemId = getItemIdFromValue(item);

        if (!itemId || typeof item !== "object" || itemMap[itemId]) return;
        itemMap[itemId] = createItemInfo(item, museumContents);
    });
}

function canRestoreTemporaryState(state) {
    if (!state) return false;
    const sameMuseum = !state.museumId || state.museumId === museumId;
    const sameVisit = (state.visitId || null) === (visitId || null);
    return sameMuseum && sameVisit;
}

function createItemCountMapFromSequence(sequence = []) {
    return sequence.reduce((counts, entry) => {
        const itemId = getItemIdFromSequenceEntry(entry);
        if (!itemId) return counts;
        counts[itemId] = (counts[itemId] || 0) + 1;
        return counts;
    }, {});
}

async function loadOriginalVisitBaseline(vId) {
    if (!vId) {
        originalVisitItemCounts = {};
        return null;
    }

    const res = await fetch(`${myApi}/visits/${vId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        throw new Error("Errore nel recupero della visita originale");
    }

    const data = await res.json();
    const visit = data.visit || data;
    originalVisitItemCounts = createItemCountMapFromSequence(visit.sequence || []);
    return visit;
}

// --- FUNZIONE PER RICOSTRUIRE IL TAVOLO ARCHIDEKT DA UNA VISITA ESISTENTE ---
async function caricaVisitaEsistente(vId, preloadedVisit = null) {
    try {
        const titleEl = document.querySelector('.visit-builder-title');
        const kickerEl = document.querySelector('.visit-builder-kicker');
        const toolbarTitleEl = document.querySelector('.section-title-new');

        if (titleEl) titleEl.textContent = "Edit your visit";
        if (kickerEl) kickerEl.textContent = "Tour editor";
        if (toolbarTitleEl) toolbarTitleEl.textContent = "Sequenza salvata";
        
        // 1. Scarichiamo i dati
        const visit = preloadedVisit || await loadOriginalVisitBaseline(vId);

        const cleanDesc = getCleanVisitDescription(visit.description || "");
        const structurData = normalizeVisitBlocks(visit);

        // 3. Compiliamo titolo e descrizione
        if(document.getElementById('v-title')) document.getElementById('v-title').value = visit.title;
        if(document.getElementById('v-desc')) document.getElementById('v-desc').value = cleanDesc;
        setVisitVisibility(visit.isPublic === true);

        if (!structurData || structurData.length === 0) {
            if(typeof createNewBlock === 'function') createNewBlock("Mainboard");
            return;
        }

        // 4. Scarichiamo le opere per stampare le carte vere
        const itemMap = await loadMuseumItemCatalog(true);
        addVisitSequenceItemsToMap(itemMap, visit, museumContentsCache);

        // 5. Ricreiamo i blocchi
        structurData.forEach(blockData => {
            createNewBlock(blockData.blockName); 
            
            const blocksNodes = document.querySelectorAll('.visit-block');
            const targetBlock = blocksNodes[blocksNodes.length - 1];
            const targetList = targetBlock.querySelector('.block-list');

            (blockData.items || []).forEach(itemId => {
                const info = itemMap[itemId];
                if (info) {
                    creaEdAggiungiItem(info.title, itemId, targetList, info.imageUrl, info.author, info.contentId);
                } else {
                    console.warn(`Opera con ID ${itemId} non trovata nel database!`);
                }
            });
        });

    } catch(err) {
        console.error("ERRORE CRITICO in caricaVisitaEsistente:", err);
        if(typeof createNewBlock === 'function') createNewBlock("Mainboard"); 
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    await loadWalletBalance();

    const savedStateRaw = sessionStorage.getItem('temp_visit_state');
    let savedState = null;

    if (savedStateRaw) {
        try {
            savedState = JSON.parse(savedStateRaw);
        } catch (error) {
            console.error("Stato temporaneo visita non valido:", error);
            sessionStorage.removeItem('temp_visit_state');
        }
    }

    const shouldRestoreState = canRestoreTemporaryState(savedState);
    let originalVisit = null;

    if (visitId) {
        try {
            originalVisit = await loadOriginalVisitBaseline(visitId);
        } catch (error) {
            console.error("Errore nel recupero del baseline della visita:", error);
            originalVisitItemCounts = {};
        }
    } else {
        originalVisitItemCounts = {};
    }

    if (visitId && !shouldRestoreState) {
        if (savedStateRaw) sessionStorage.removeItem('temp_visit_state');
        await caricaVisitaEsistente(visitId, originalVisit);
    } else {
        if (shouldRestoreState) {
            const state = savedState;
            if(document.getElementById('v-title')) document.getElementById('v-title').value = state.title;
            if(document.getElementById('v-desc')) document.getElementById('v-desc').value = state.desc;
            setVisitVisibility(state.isPublic === true);
            
            const addBtn = document.getElementById('add-block-btn');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = state.blocks;
            
            Array.from(tempDiv.children).forEach(block => {
                blocksContainer.insertBefore(block, addBtn);
                
                const ulList = block.querySelector('.block-list');
                setupDragAndDropForList(ulList);
                
                block.querySelector('.add-item-to-block').addEventListener('click', () => {
                    activeBlockList = ulList; apriModaleOpere();
                });
                block.querySelector('.delete-block-btn').addEventListener('click', () => {
                    if(confirm("Do you really want to delete this column? All the artworks will be removed too..")) { 
                        block.remove(); aggiornaContatoriBlocchi(); 
                    }
                });
                
                block.querySelectorAll('.draggable-item').forEach(li => {
                    const itemId = li.dataset.itemId;
                    const titoloOpera = li.dataset.title || li.querySelector('strong').innerText;
                    const author = li.dataset.author || "Autore Ignoto";
                    const imageUrl = li.dataset.imageUrl || "";
                    const contentId = li.dataset.contentId || "";

                    li.querySelector('.delete-btn').addEventListener('click', () => { li.remove(); aggiornaContatoriBlocchi(); });
                    
                    li.addEventListener('dragstart', function(e) {
                        draggedItem = this;
                        placeholder.style.height = `${this.offsetHeight}px`;
                        setTimeout(() => {
                            this.classList.add('dragging');
                            this.parentNode.insertBefore(placeholder, this.nextSibling);
                            aggiornaContatoriBlocchi(); 
                        }, 0);
                    });
                    
                    li.addEventListener('dragend', function() {
                        this.classList.remove('dragging');
                        if (placeholder.parentNode) {
                            placeholder.parentNode.insertBefore(this, placeholder);
                            placeholder.parentNode.removeChild(placeholder);
                        }
                        draggedItem = null;
                        aggiornaContatoriBlocchi(); 
                    });

                    li.addEventListener('click', function(e) {
                        if(e.target.closest('.delete-btn') || e.target.closest('.drag-handle')) return;
                        salvaStatoTemporaneo();
                        const params = new URLSearchParams({
                            itemId: itemId,
                            museumId: museumId,
                            museumName: museumName,
                            title: titoloOpera,
                            author: author,
                            image: imageUrl
                        });
                        if (visitId) params.set('visitId', visitId);
                        if (contentId) params.set('contentId', contentId);
                        window.location.href = `create_items.html?${params.toString()}`;
                    });
                });
            });
            
            blockCounter = state.blockCounter;
            aggiornaContatoriBlocchi();
            sessionStorage.removeItem('temp_visit_state'); 
        } else {
            createNewBlock("Mainboard");
        }
    }

    try {
        await loadMuseumItemCatalog(true);
    } catch (error) {
        console.error("Errore nel caricamento del catalogo prezzi:", error);
    }

    updateWalletPreview();
});

// --- SALVATAGGIO FINALE NEL DATABASE ---

document.getElementById('save-visit-btn').addEventListener('click', async () => {
    const title = document.getElementById('v-title').value;
    const desc = document.getElementById('v-desc').value;
    
    if (!title.trim()) { 
        alert("Inserisci un titolo per la visita."); 
        return; 
    }

    const structurData = [];
    let sequenceObjects = []; 
    let globalOrder = 1;

    // Raccogliamo i dati e costruiamo gli oggetti
    document.querySelectorAll('.visit-block').forEach(block => {
        const blockTitle = block.querySelector('.block-title-input').value;
        const itemsNodes = block.querySelectorAll('.draggable-item');
        const itemsIds = Array.from(itemsNodes).map(node => node.dataset.itemId);
        
        structurData.push({ blockName: blockTitle, items: itemsIds });
        
        itemsIds.forEach(id => {
            sequenceObjects.push({
                itemId: id,
                order: globalOrder++,
                nextDirections: "",
                prevDirections: ""
            });
        });
    });

    if (sequenceObjects.length === 0) { 
        alert("Aggiungi almeno un'opera alla visita."); 
        return; 
    }

    // Costruiamo il payload perfetto
    const payload = {
        title: title,
        description: desc,
        museumId: museumId,
        sequence: sequenceObjects,
        blocks: structurData,
        isPublic: getVisitVisibility(),
        type: "standard", 
        length: "normal"  
    };
    
    try {
        // Se c'e' un visitId sovrascriviamo (PUT), altrimenti creiamo nuovo (POST)
        const method = visitId ? 'PUT' : 'POST';
        const url = visitId ? `${myApi}/visits/${visitId}` : `${myApi}/visits`;

        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (typeof data.walletBalance === 'number') {
                currentWalletBalance = data.walletBalance;
            }
            originalVisitItemCounts = createItemCountMapFromSequence(sequenceObjects);
            updateWalletPreview();
            sessionStorage.removeItem('temp_visit_state');

            const chargedAmount = Number(data.chargedAmount) || 0;
            const successMessage = chargedAmount > 0
                ? `Visita salvata. Addebito effettuato: ${formatCurrencyAmount(chargedAmount)}.`
                : "Visita salvata con successo nel database!";
            alert(successMessage);
            
            // Reindirizziamo al Marketplace
            window.location.href = `visits_list.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`; 
        } else {
            const errorData = await res.json().catch(() => ({}));
            console.error("Errore Backend:", errorData);
            alert(errorData.error || "Impossibile salvare la visita.");
        }
    } catch(err) {
        console.error("Errore di rete:", err);
        alert("Errore di connessione al server.");
    }
});
