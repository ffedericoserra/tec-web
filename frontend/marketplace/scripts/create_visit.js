const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token") || localStorage.getItem("artaround_token");
const CONTENT_PLACEHOLDER = "/uploads/placeholders/template-no-image.jpg";

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
const sectionTypeModal = document.getElementById('section-type-modal');
const itemsContainer = document.getElementById('items-container');
const walletCurrentEl = document.getElementById('visit-wallet-current');
const walletPendingEl = document.getElementById('visit-wallet-pending');
const walletRemainingEl = document.getElementById('visit-wallet-remaining');
const visitVisibilityInput = document.getElementById('v-is-public');
const visitVisibilityStatus = document.getElementById('visit-visibility-status');
const visitVisibilityHint = document.getElementById('visit-visibility-hint');
const visitGroupInput = document.getElementById('v-group');
const visitGroupStatus = document.getElementById('visit-group-status');
const visitGroupHint = document.getElementById('visit-group-hint');
let activeBlockList = null;
let pendingItemReplacement = null;
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

if (visitGroupInput) {
    visitGroupInput.addEventListener('change', () => {
        setGroupVisit(visitGroupInput.checked);
    });
    setGroupVisit(false);
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

function getGroupVisit() {
    return Boolean(visitGroupInput?.checked);
}

function setGroupVisit(isGroup) {
    const enabled = Boolean(isGroup);
    if (visitGroupInput) visitGroupInput.checked = enabled;
    if (visitGroupStatus) {
        visitGroupStatus.textContent = enabled ? "Visita di gruppo" : "Visita standard";
    }
    if (visitGroupHint) {
        visitGroupHint.textContent = enabled
            ? "Sessione sincronizzata abilitata"
            : "Attiva per consentire una sessione sincronizzata";
    }
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
        if (currentCount > previousCount && previousCount === 0) {
            total += Number(itemCatalog[itemId]?.adoptionPrice) || 0;
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
    const currentCounts = countVisitItemsFromDom();
    const itemPrice = currentCounts[itemId] || originalVisitItemCounts[itemId]
        ? 0
        : Number(itemCatalog[itemId]?.adoptionPrice) || 0;
    const remainingBalance = currentWalletBalance - calculatePendingVisitCost();
    return itemPrice <= remainingBalance;
}

function refreshModalItemAvailability() {
    const remainingBalance = currentWalletBalance - calculatePendingVisitCost();

    Array.from(itemsContainer.querySelectorAll('.modal-artwork-item')).forEach((button) => {
        if (button.dataset.action === 'create-item') {
            button.disabled = false;
            button.title = 'Create Item';
            return;
        }

        const itemId = button.dataset.itemId;
        const currentCounts = countVisitItemsFromDom();
        const itemPrice = currentCounts[itemId] || originalVisitItemCounts[itemId]
            ? 0
            : Number(itemCatalog[itemId]?.adoptionPrice) || 0;
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
let questionEditorCounter = 0;

function getQuestionEditorId(editor) {
    if (!editor.dataset.questionEditorId) {
        questionEditorCounter += 1;
        editor.dataset.questionEditorId = `question-${Date.now()}-${questionEditorCounter}`;
    }
    return editor.dataset.questionEditorId;
}

function createCorrectOptionControl(editor, isCorrect = false) {
    const correctLabel = document.createElement('label');
    correctLabel.classList.add('question-correct-label');

    const correctInput = document.createElement('input');
    correctInput.type = 'radio';
    correctInput.name = `correct-option-${getQuestionEditorId(editor)}`;
    correctInput.classList.add('question-correct-option');
    correctInput.checked = isCorrect;
    correctInput.setAttribute('aria-label', 'Set as correct answer');

    const correctText = document.createElement('span');
    correctText.textContent = 'Correct';
    correctLabel.append(correctInput, correctText);
    return correctLabel;
}

function addQuestionOption(editor, value = "", isCorrect = false) {
    const optionsContainer = editor.querySelector('.question-options-list');
    const row = document.createElement('div');
    row.classList.add('question-option-row');

    const correctLabel = createCorrectOptionControl(editor, isCorrect);

    const input = document.createElement('input');
    input.type = 'text';
    input.classList.add('question-option-input');
    input.placeholder = 'Answer option';
    input.value = value;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.classList.add('delete-option-btn');
    deleteButton.setAttribute('aria-label', 'Remove option');
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', () => row.remove());
    deleteButton.dataset.bound = 'true';

    row.append(correctLabel, input, deleteButton);
    optionsContainer.appendChild(row);
}

function bindQuestionEditor(editor) {
    const typeSelect = editor.querySelector('.question-answer-type');
    const optionsEditor = editor.querySelector('.question-options-editor');

    getQuestionEditorId(editor);
    editor.querySelectorAll('.question-option-row').forEach((row) => {
        const existingControl = row.querySelector('.question-correct-option');
        if (existingControl) {
            existingControl.name = `correct-option-${getQuestionEditorId(editor)}`;
        } else {
            row.prepend(createCorrectOptionControl(editor));
        }
    });

    const syncAnswerType = () => {
        const isMultipleChoice = typeSelect.value === 'multiple-choice';
        optionsEditor.classList.toggle('hidden', !isMultipleChoice);
        if (isMultipleChoice && editor.querySelectorAll('.question-option-row').length === 0) {
            addQuestionOption(editor);
            addQuestionOption(editor);
        }
    };

    typeSelect.addEventListener('change', syncAnswerType);
    editor.querySelector('.delete-question-btn').addEventListener('click', () => {
        editor.remove();
        aggiornaContatoriBlocchi();
    });
    editor.querySelector('.add-question-option').addEventListener('click', () => {
        addQuestionOption(editor);
    });
    editor.querySelectorAll('.delete-option-btn').forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.addEventListener('click', () => button.closest('.question-option-row').remove());
        button.dataset.bound = 'true';
    });
    syncAnswerType();
}

function createQuestionEditor(question = {}) {
    const editor = document.createElement('article');
    editor.classList.add('question-editor');
    getQuestionEditorId(editor);
    editor.innerHTML = `
        <div class="question-editor-header">
            <select class="question-answer-type" aria-label="Answer type">
                <option value="open">Open answer</option>
                <option value="multiple-choice">Multiple choice</option>
            </select>
            <button type="button" class="delete-question-btn" aria-label="Remove question">&times;</button>
        </div>
        <textarea class="question-prompt" placeholder="Write the question" aria-label="Question text"></textarea>
        <div class="question-options-editor">
            <div class="question-options-list"></div>
            <button type="button" class="add-question-option">Add option</button>
        </div>
    `;

    editor.querySelector('.question-answer-type').value = question.answerType || 'open';
    editor.querySelector('.question-prompt').value = question.prompt || '';
    const options = question.answerType === 'multiple-choice'
        ? (question.options?.length ? question.options : ['', ''])
        : (question.options || []);
    options.forEach((option, optionIndex) => {
        addQuestionOption(editor, option, optionIndex === question.correctIndex);
    });
    bindQuestionEditor(editor);
    return editor;
}

function bindBlockDelete(block) {
    block.querySelector('.delete-block-btn').addEventListener('click', () => {
        const message = block.dataset.sectionType === 'questions'
            ? 'Delete this question section and all its questions?'
            : 'Delete this artwork section and all its artworks?';
        if (confirm(message)) {
            block.remove();
            aggiornaContatoriBlocchi();
        }
    });
}

function normalizeBlockAddButton(block) {
    const isQuestionBlock = block.dataset.sectionType === 'questions';
    const button = block.querySelector(
        isQuestionBlock ? '.add-question-to-block' : '.add-item-to-block'
    );
    if (!button) return;

    const label = isQuestionBlock ? 'Add question' : 'Add artwork';
    button.classList.add('add-btn', 'block-add-btn');
    button.textContent = '';
    button.dataset.tooltip = label;
    button.setAttribute('aria-label', label);
    button.removeAttribute('title');
}

function createNewBlock(defaultTitle = "New Section", sectionType = "artwork", questions = []) {
    blockCounter++;
    const block = document.createElement('div');
    block.classList.add('visit-block');
    block.dataset.sectionType = sectionType;

    const sectionBody = sectionType === 'questions'
        ? `<div class="question-list"></div>
           <div class="block-footer">
             <button class="add-btn block-add-btn add-question-to-block" type="button" aria-label="Add question" data-tooltip="Add question"></button>
           </div>`
        : `<ul class="block-list"></ul>
           <div class="block-footer">
             <button class="add-btn block-add-btn add-item-to-block" type="button" aria-label="Add artwork" data-tooltip="Add artwork"></button>
           </div>`;

    block.innerHTML = `
      <div class="block-header">
        <span class="block-number">${toRoman(blockCounter)}</span>
        <input type="text" class="block-title-input" value="${escapeHTML(defaultTitle)}">
        <span class="block-count">0 ${sectionType === 'questions' ? 'questions' : 'artworks'}</span>
        <button class="delete-block-btn" type="button" title="Remove section" aria-label="Remove section">&times;</button>
      </div>
      ${sectionBody}
    `;

    normalizeBlockAddButton(block);
    bindBlockDelete(block);

    if (sectionType === 'questions') {
        block.classList.add('question-block');
        const questionList = block.querySelector('.question-list');
        const initialQuestions = questions.length ? questions : [{}];
        initialQuestions.forEach((question) => {
            questionList.appendChild(createQuestionEditor(question));
        });
        block.querySelector('.add-question-to-block').addEventListener('click', () => {
            questionList.appendChild(createQuestionEditor());
            aggiornaContatoriBlocchi();
        });
    } else {
        const ulList = block.querySelector('.block-list');
        block.querySelector('.add-item-to-block').addEventListener('click', () => {
            activeBlockList = ulList;
            apriModaleOpere();
        });
        setupDragAndDropForList(ulList);
    }

    blocksContainer.insertBefore(block, addBlockBtnWrapper);
    aggiornaContatoriBlocchi();
}

addBlockBtnWrapper.addEventListener('click', () => {
    sectionTypeModal.classList.remove('hidden');
});

document.querySelectorAll('[data-section-type]').forEach((button) => {
    button.addEventListener('click', () => {
        const sectionType = button.dataset.sectionType;
        if (sectionType === 'questions') setGroupVisit(true);
        createNewBlock(
            sectionType === 'questions' ? 'Questions' : 'New Section',
            sectionType
        );
        sectionTypeModal.classList.add('hidden');
    });
});

document.getElementById('close-section-type-modal').addEventListener('click', () => {
    sectionTypeModal.classList.add('hidden');
});

function aggiornaContatoriBlocchi() {
    const blocks = document.querySelectorAll('.visit-block');
    blocks.forEach((block, index) => {
        block.querySelector('.block-number').textContent = toRoman(index + 1);
        const isQuestions = block.dataset.sectionType === 'questions';
        const count = isQuestions
            ? block.querySelectorAll('.question-editor').length
            : block.querySelectorAll('.draggable-item').length;
        block.querySelector('.block-count').textContent = `${count} ${isQuestions ? 'questions' : 'artworks'}`;
    });
    updateWalletPreview();
    refreshModalItemAvailability();
}

// --- LOGICA RECUPERO OPERE ED INCROCIO CON I CONTENTS ---
async function apriModaleOpere(itemToReplace = null) {
    pendingItemReplacement = itemToReplace;
    itemModal.classList.remove('hidden');
    itemsContainer.innerHTML = renderBuilderMessage(
        itemToReplace ? "Caricamento Item alternativi..." : "Caricamento opere..."
    );
    updateWalletPreview();

    try {
        const catalog = await loadMuseumItemCatalog(true);
        const requestedContentId = itemToReplace?.dataset.contentId || '';
        const museumItems = Object.entries(catalog).filter(([, itemInfo]) =>
            !requestedContentId || itemInfo.contentId === requestedContentId
        );
        const representedContentIds = new Set(
            museumItems.map(([, itemInfo]) => itemInfo.contentId).filter(Boolean)
        );
        const contentsWithoutItems = museumContentsCache.filter(
            (content) =>
                !itemToReplace &&
                content.type === 'Artwork' &&
                content.universalId &&
                !representedContentIds.has(content.universalId)
        );

        itemsContainer.innerHTML = '';
        if (museumItems.length > 0 || contentsWithoutItems.length > 0) {
            museumItems.forEach(([itemId, itemInfo]) => {
                const itemDiv = document.createElement('button');
                itemDiv.type = 'button';
                itemDiv.classList.add('modal-artwork-item');
                itemDiv.dataset.itemId = itemId;
                const itemPrice = Number(itemInfo.adoptionPrice) || 0;
                const priceLabel = itemInfo.isOwned
                    ? 'Owned'
                    : itemInfo.isPurchased
                        ? 'Acquired'
                        : itemPrice > 0 ? formatCurrencyAmount(itemPrice) : 'Free';

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
                    const replacement = pendingItemReplacement;
                    creaEdAggiungiItem(
                        itemInfo.title,
                        itemId,
                        activeBlockList,
                        itemInfo.imageUrl,
                        itemInfo.author,
                        itemInfo.contentId,
                        replacement?.dataset.nextDirections || '',
                        replacement?.dataset.prevDirections || '',
                        replacement
                    );
                    pendingItemReplacement = null;
                    itemModal.classList.add('hidden');
                };
                itemsContainer.appendChild(itemDiv);
            });

            contentsWithoutItems.forEach((content) => {
                const itemDiv = document.createElement('button');
                itemDiv.type = 'button';
                itemDiv.classList.add('modal-artwork-item', 'create-content-item');
                itemDiv.dataset.action = 'create-item';

                const imageUrl = contentImagePath(content);
                const finalImgUrl = resolveAssetUrl(imageUrl);
                const imgTag = finalImgUrl
                    ? `<img src="${escapeHTML(finalImgUrl)}" alt="${escapeHTML(content.name)}" class="modal-artwork-image">`
                    : '<span class="image-fallback">IMG</span>';

                itemDiv.innerHTML = `
                    <div class="modal-artwork-row">
                        <div class="modal-artwork-thumb">${imgTag}</div>
                        <span class="modal-artwork-copy">
                            <strong>${escapeHTML(content.name || 'Opera')}</strong>
                            <small>${escapeHTML(content.author || 'Autore Ignoto')}</small>
                        </span>
                        <span class="modal-artwork-price">Create Item</span>
                    </div>
                    <div class="modal-artwork-preview">
                        <div class="modal-artwork-preview-frame">${imgTag}</div>
                    </div>
                `;

                itemDiv.querySelectorAll('.modal-artwork-image').forEach((img) => {
                    img.addEventListener('error', () => img.classList.add('is-hidden'));
                });
                itemDiv.addEventListener('click', () => {
                    salvaStatoTemporaneo();
                    const params = new URLSearchParams({
                        museumId,
                        museumName,
                        source: 'visit',
                        title: content.name || 'Opera',
                        author: content.author || 'Autore Ignoto',
                        image: imageUrl,
                        year: content.year || 'N/D',
                        contentId: content.universalId
                    });
                    if (visitId) params.set('visitId', visitId);
                    window.location.href = `create_items.html?${params.toString()}`;
                });
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

document.getElementById('close-item-modal').addEventListener('click', () => {
    pendingItemReplacement = null;
    itemModal.classList.add('hidden');
});

// --- DRAG & DROP INCROCIATO & CREAZIONE CARTA ---
let draggedItem = null;
let dragSourceList = null;
const dragPreparedLists = new Set();
const boundArtworkItems = new WeakSet();
let placeholder = document.createElement('li');
placeholder.classList.add('placeholder');
let routeNodeCounter = 0;

function ensureRouteNodeId(item) {
    if (!item.dataset.routeNodeId) {
        routeNodeCounter += 1;
        item.dataset.routeNodeId = `route-${Date.now()}-${routeNodeCounter}`;
    }
    return item.dataset.routeNodeId;
}

function getArtworkItems(listElement) {
    return Array.from(listElement?.children || []).filter((node) =>
        node.classList.contains('draggable-item')
    );
}

function importLegacyDirectionFields(listElement) {
    getArtworkItems(listElement).forEach((item) => {
        const previousField = item.querySelector('.item-prev-directions');
        const nextField = item.querySelector('.item-next-directions');
        if (previousField) item.dataset.prevDirections = previousField.value;
        if (nextField) item.dataset.nextDirections = nextField.value;
        item.querySelector('.route-fields')?.remove();
    });
}

function syncRouteConnectorValues(listElement) {
    if (!listElement) return;

    listElement.querySelectorAll('.route-connector').forEach((connector) => {
        const previousItem = connector.previousElementSibling;
        const nextItem = connector.nextElementSibling;
        const field = connector.querySelector('.direction-field');
        if (
            previousItem?.classList.contains('draggable-item') &&
            nextItem?.classList.contains('draggable-item') &&
            field
        ) {
            previousItem.dataset.nextDirections = field.value;
            nextItem.dataset.prevDirections = field.value;
        }
    });
}

function createRouteConnector(previousItem, nextItem) {
    const connector = document.createElement('li');
    connector.classList.add('route-connector');

    const inner = document.createElement('div');
    inner.classList.add('route-connector-inner');

    const label = document.createElement('label');
    label.classList.add('route-connector-label');

    const heading = document.createElement('span');
    heading.classList.add('route-connector-heading');
    heading.textContent = 'Indicazioni di percorso';

    const path = document.createElement('span');
    path.classList.add('route-connector-path');
    path.textContent = `${previousItem.dataset.title || 'Opera'} → ${nextItem.dataset.title || 'Opera'}`;

    const previousNodeId = ensureRouteNodeId(previousItem);
    const nextNodeId = ensureRouteNodeId(nextItem);
    const hasPreviousPair = Boolean(
        previousItem.dataset.nextRouteNodeId || nextItem.dataset.prevRouteNodeId
    );
    const isSamePair =
        previousItem.dataset.nextRouteNodeId === nextNodeId &&
        nextItem.dataset.prevRouteNodeId === previousNodeId;
    const routeValue = hasPreviousPair && !isSamePair
        ? ''
        : previousItem.dataset.nextDirections || nextItem.dataset.prevDirections || '';

    const field = document.createElement('textarea');
    field.classList.add('direction-field');
    field.rows = 2;
    field.placeholder = `Come raggiungere ${nextItem.dataset.title || 'la prossima opera'}`;
    field.setAttribute(
        'aria-label',
        `Indicazioni da ${previousItem.dataset.title || 'opera precedente'} a ${nextItem.dataset.title || 'opera successiva'}`
    );
    field.value = routeValue;

    previousItem.dataset.nextDirections = field.value;
    nextItem.dataset.prevDirections = field.value;
    previousItem.dataset.nextRouteNodeId = nextNodeId;
    nextItem.dataset.prevRouteNodeId = previousNodeId;
    field.addEventListener('input', () => {
        previousItem.dataset.nextDirections = field.value;
        nextItem.dataset.prevDirections = field.value;
    });

    label.append(heading, path, field);
    inner.appendChild(label);
    connector.appendChild(inner);
    return connector;
}

function refreshRouteConnectors(listElement) {
    if (!listElement) return;

    importLegacyDirectionFields(listElement);
    syncRouteConnectorValues(listElement);
    listElement.querySelectorAll('.route-connector').forEach((connector) => connector.remove());

    const items = getArtworkItems(listElement);
    items.slice(0, -1).forEach((item, index) => {
        item.after(createRouteConnector(item, items[index + 1]));
    });
}

function prepareListForDrag(listElement) {
    if (!listElement || dragPreparedLists.has(listElement)) return;
    importLegacyDirectionFields(listElement);
    syncRouteConnectorValues(listElement);
    listElement.querySelectorAll('.route-connector').forEach((connector) => connector.remove());
    dragPreparedLists.add(listElement);
}

function openItemEditor(item) {
    salvaStatoTemporaneo();

    const params = new URLSearchParams({
        itemId: item.dataset.itemId,
        museumId,
        museumName,
        source: 'visit',
        title: item.dataset.title || 'Opera',
        author: item.dataset.author || 'Autore Ignoto',
        image: item.dataset.imageUrl || ''
    });
    if (visitId) params.set('visitId', visitId);
    if (item.dataset.contentId) params.set('contentId', item.dataset.contentId);
    window.location.href = `create_items.html?${params.toString()}`;
}

function bindArtworkItem(item) {
    if (boundArtworkItems.has(item)) return;
    boundArtworkItems.add(item);
    ensureRouteNodeId(item);

    item.querySelectorAll('.draggable-item-image').forEach((image) => {
        image.addEventListener('error', () => image.classList.add('is-hidden'));
    });

    item.addEventListener('click', (event) => {
        if (event.target.closest('button, input, textarea, select, a')) return;
        openItemEditor(item);
    });

    item.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target === item) {
            event.preventDefault();
            item.click();
        }
    });

    item.querySelector('.delete-btn').addEventListener('click', () => {
        const listElement = item.parentElement;
        syncRouteConnectorValues(listElement);
        item.remove();
        refreshRouteConnectors(listElement);
        aggiornaContatoriBlocchi();
    });

    item.querySelector('.edit-item-btn')?.addEventListener('click', () => {
        openItemEditor(item);
    });

    item.querySelector('.replace-item-btn')?.addEventListener('click', () => {
        activeBlockList = item.parentElement;
        apriModaleOpere(item);
    });

    item.addEventListener('dragstart', () => {
        draggedItem = item;
        dragSourceList = item.parentElement;
        prepareListForDrag(dragSourceList);
        setTimeout(() => {
            item.classList.add('dragging');
            item.parentNode.insertBefore(placeholder, item.nextSibling);
        }, 0);
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        const destinationList = placeholder.parentNode || item.parentElement;
        if (placeholder.parentNode) {
            placeholder.parentNode.insertBefore(item, placeholder);
            placeholder.remove();
        }

        if (dragSourceList) dragPreparedLists.add(dragSourceList);
        if (destinationList) dragPreparedLists.add(destinationList);
        dragPreparedLists.forEach((listElement) => refreshRouteConnectors(listElement));
        dragPreparedLists.clear();
        dragSourceList = null;
        draggedItem = null;
        aggiornaContatoriBlocchi();
    });
}

function creaEdAggiungiItem(
    titoloOpera,
    itemId,
    targetList,
    imageUrl = null,
    author = "Autore Ignoto",
    contentId = "",
    nextDirections = "",
    prevDirections = "",
    itemToReplace = null
) {
    const li = document.createElement('li');
    li.classList.add('draggable-item');
    li.setAttribute('draggable', 'true');
    li.setAttribute('tabindex', '0');
    li.dataset.itemId = itemId;
    li.dataset.title = titoloOpera || "";
    li.dataset.author = author || "";
    li.dataset.imageUrl = imageUrl || "";
    li.dataset.contentId = contentId || "";
    li.dataset.nextDirections = nextDirections || "";
    li.dataset.prevDirections = prevDirections || "";

    // Risolviamo il percorso dell'immagine
    const finalImgUrl = resolveAssetUrl(imageUrl);
    const imgTag = finalImgUrl
        ? `<img src="${escapeHTML(finalImgUrl)}" alt="${escapeHTML(titoloOpera)}" class="draggable-item-image">`
        : '<span class="image-fallback">IMG</span>';

    const priceInfo = itemCatalog[itemId];
    const priceValue = Number(priceInfo?.price) || 0;
    const priceLabel = priceInfo?.isOwned
        ? 'Owned'
        : priceInfo?.isPurchased
            ? 'Acquired'
            : priceValue > 0 ? `${priceValue} Aα` : 'Free';
    const priceClass = priceValue > 0 ? 'is-paid' : 'is-free';

    li.innerHTML = `
        <div class="card-header">
            <div class="card-thumb">${imgTag}</div>
            <div class="card-title-block">
                <strong class="card-title">${escapeHTML(titoloOpera)}</strong>
                <div class="card-meta-row">
                    <span class="meta-pill meta-pill-author">${escapeHTML(author)}</span>
                    <span class="meta-pill meta-pill-price ${priceClass}">${escapeHTML(priceLabel)}</span>
                </div>
            </div>
        </div>
        <div class="card-details">
            <div class="card-image-placeholder">
                ${imgTag}
            </div>
            <div class="card-copy">
                <p class="card-author"><strong>${escapeHTML(author)}</strong></p>
                <p class="card-note">Modifica i testi oppure cambia l'Item senza rimuovere la tappa.</p>
            </div>
            <div class="card-actions">
                <button type="button" class="edit-item-btn">Modifica testi</button>
                <button type="button" class="replace-item-btn">Cambia Item</button>
                <button type="button" class="drag-handle" title="Trascina per riordinare" aria-label="Trascina per riordinare">
                    <span class="drag-handle-dots" aria-hidden="true">
                        <span></span><span></span><span></span><span></span><span></span><span></span>
                    </span>
                </button>
                <button type="button" class="delete-btn" title="Rimuovi opera" aria-label="Rimuovi opera">&times;</button>
            </div>
        </div>
    `;

    bindArtworkItem(li);
    if (itemToReplace?.parentElement === targetList) {
        targetList.replaceChild(li, itemToReplace);
    } else {
        targetList.appendChild(li);
    }
    refreshRouteConnectors(targetList);
    aggiornaContatoriBlocchi();
}

function setupDragAndDropForList(listElement) {
    listElement.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (!draggedItem) return;
        prepareListForDrag(listElement);

        const afterElement = getDragAfterElement(listElement, e.clientY);
        if (afterElement == null) {
            listElement.appendChild(placeholder);
        } else {
            listElement.insertBefore(placeholder, afterElement);
        }
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
    const length = document.getElementById('v-length')?.value || 'normal';

    const blocksHtmlNodes = Array.from(document.getElementById('blocks-container').children).filter(el => el.id !== 'add-block-btn');
    blocksHtmlNodes.forEach((block) => {
        syncRouteConnectorValues(block.querySelector('.block-list'));
        block.querySelectorAll('input, textarea, select').forEach((field) => {
            if (field.tagName === 'TEXTAREA') {
                field.textContent = field.value;
            } else if (field.tagName === 'SELECT') {
                Array.from(field.options).forEach((option) => {
                    option.toggleAttribute('selected', option.value === field.value);
                });
            } else if (field.type === 'radio' || field.type === 'checkbox') {
                field.toggleAttribute('checked', field.checked);
            } else {
                field.setAttribute('value', field.value);
            }
        });
    });
    const blocksHtml = blocksHtmlNodes.map(el => el.outerHTML).join('');

    const visitState = {
        title: title,
        desc: desc,
        length: length,
        isPublic: getVisitVisibility(),
        isGroup: getGroupVisit(),
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
            type: block.type || 'artwork',
            blockName: block.blockName || block.title || `Section ${index + 1}`,
            items: (block.items || []).map(getItemIdFromValue).filter(Boolean),
            questions: (block.questions || []).map((question) => ({
                prompt: question.prompt || '',
                answerType: question.answerType || 'open',
                options: question.options || [],
                correctIndex: Number.isInteger(question.correctIndex)
                    ? question.correctIndex
                    : undefined
            }))
        }));
    }

    const sequence = Array.isArray(visit.sequence) ? [...visit.sequence] : [];
    const sequenceItems = sequence
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(getItemIdFromSequenceEntry)
        .filter(Boolean);

    return sequenceItems.length > 0
        ? [{ type: 'artwork', blockName: "Mainboard", items: sequenceItems, questions: [] }]
        : [];
}

function getItemTitle(item, relatedContent) {
    return item?.descriptions?.[0]?.title || relatedContent?.name || "Opera";
}

function createItemInfo(item, museumContents) {
    const relatedContent = museumContents.find(c => c.universalId === item.contentId);

    return {
        title: getItemTitle(item, relatedContent),
        author: relatedContent?.author || "Autore Ignoto",
        imageUrl: contentImagePath(relatedContent),
        contentId: item.contentId || "",
        price: Number(item.price) || 0,
        adoptionPrice: Number(item.adoptionPrice ?? item.price) || 0,
        isOwned: item.isOwned === true,
        isPurchased: item.isPurchased === true
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
        if(document.getElementById('v-length')) document.getElementById('v-length').value = visit.length || 'normal';
        setVisitVisibility(visit.isPublic === true);
        setGroupVisit(visit.type === 'synchronized');

        if (!structurData || structurData.length === 0) {
            if(typeof createNewBlock === 'function') createNewBlock("Mainboard");
            return;
        }

        // 4. Scarichiamo le opere per stampare le carte vere
        const itemMap = await loadMuseumItemCatalog(true);
        addVisitSequenceItemsToMap(itemMap, visit, museumContentsCache);
        const sequenceEntriesByItem = new Map();
        [...(visit.sequence || [])]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .forEach((entry) => {
                const itemId = getItemIdFromSequenceEntry(entry);
                if (!sequenceEntriesByItem.has(itemId)) sequenceEntriesByItem.set(itemId, []);
                sequenceEntriesByItem.get(itemId).push(entry);
            });

        // 5. Ricreiamo i blocchi
        structurData.forEach(blockData => {
            createNewBlock(
                blockData.blockName,
                blockData.type || 'artwork',
                blockData.questions || []
            );

            const blocksNodes = document.querySelectorAll('.visit-block');
            const targetBlock = blocksNodes[blocksNodes.length - 1];
            const targetList = targetBlock.querySelector('.block-list');

            if (blockData.type === 'questions') return;

            (blockData.items || []).forEach(itemId => {
                const info = itemMap[itemId];
                if (info) {
                    const sequenceEntry = sequenceEntriesByItem.get(itemId)?.shift();
                    creaEdAggiungiItem(
                        info.title,
                        itemId,
                        targetList,
                        info.imageUrl,
                        info.author,
                        info.contentId,
                        sequenceEntry?.nextDirections || '',
                        sequenceEntry?.prevDirections || ''
                    );
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
            if(document.getElementById('v-length')) document.getElementById('v-length').value = state.length || 'normal';
            setVisitVisibility(state.isPublic === true);
            setGroupVisit(state.isGroup === true);

            const addBtn = document.getElementById('add-block-btn');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = state.blocks;

            Array.from(tempDiv.children).forEach(block => {
                blocksContainer.insertBefore(block, addBtn);
                block.dataset.sectionType = block.dataset.sectionType || 'artwork';
                normalizeBlockAddButton(block);
                bindBlockDelete(block);

                if (block.dataset.sectionType === 'questions') {
                    const questionList = block.querySelector('.question-list');
                    block.querySelectorAll('.question-editor').forEach(bindQuestionEditor);
                    block.querySelector('.add-question-to-block').addEventListener('click', () => {
                        questionList.appendChild(createQuestionEditor());
                        aggiornaContatoriBlocchi();
                    });
                    return;
                }

                const ulList = block.querySelector('.block-list');
                setupDragAndDropForList(ulList);

                block.querySelector('.add-item-to-block').addEventListener('click', () => {
                    activeBlockList = ulList; apriModaleOpere();
                });
                block.querySelectorAll('.draggable-item').forEach(bindArtworkItem);
                refreshRouteConnectors(ulList);
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
    let validationError = "";

    // Raccogliamo i dati e costruiamo gli oggetti
    document.querySelectorAll('.visit-block').forEach(block => {
        if (validationError) return;

        const blockTitle = block.querySelector('.block-title-input').value.trim() || 'Section';
        const sectionType = block.dataset.sectionType || 'artwork';

        if (sectionType === 'questions') {
            const questions = Array.from(block.querySelectorAll('.question-editor')).map((editor) => {
                const answerType = editor.querySelector('.question-answer-type').value;
                const prompt = editor.querySelector('.question-prompt').value.trim();
                const optionRows = Array.from(editor.querySelectorAll('.question-option-row'))
                    .map((row) => ({
                        value: row.querySelector('.question-option-input').value.trim(),
                        isCorrect: row.querySelector('.question-correct-option')?.checked === true
                    }))
                    .filter((option) => Boolean(option.value));
                const options = optionRows.map((option) => option.value);
                const correctIndex = optionRows.findIndex((option) => option.isCorrect);

                if (!prompt) {
                    validationError = `Write every question in section "${blockTitle}".`;
                } else if (answerType === 'multiple-choice' && options.length < 2) {
                    validationError = `Add at least two options to every multiple-choice question in "${blockTitle}".`;
                } else if (answerType === 'multiple-choice' && correctIndex < 0) {
                    validationError = `Select the correct option for every multiple-choice question in "${blockTitle}".`;
                }

                return {
                    prompt,
                    answerType,
                    options: answerType === 'multiple-choice' ? options : [],
                    ...(answerType === 'multiple-choice' && { correctIndex })
                };
            });

            if (questions.length === 0) {
                validationError = `Add at least one question to section "${blockTitle}".`;
            }
            structurData.push({
                type: 'questions',
                blockName: blockTitle,
                items: [],
                questions
            });
            return;
        }

        const itemsNodes = block.querySelectorAll('.draggable-item');
        syncRouteConnectorValues(block.querySelector('.block-list'));
        const itemsIds = Array.from(itemsNodes).map(node => node.dataset.itemId);

        structurData.push({
            type: 'artwork',
            blockName: blockTitle,
            items: itemsIds,
            questions: []
        });

        Array.from(itemsNodes).forEach(node => {
            sequenceObjects.push({
                itemId: node.dataset.itemId,
                order: globalOrder++,
                nextDirections: (node.dataset.nextDirections || "").trim(),
                prevDirections: (node.dataset.prevDirections || "").trim()
            });
        });
    });

    if (validationError) {
        alert(validationError);
        return;
    }

    const questionCount = structurData.reduce(
        (total, block) => total + (block.questions?.length || 0),
        0
    );
    if (sequenceObjects.length === 0 && questionCount === 0) {
        alert("Aggiungi almeno un'opera o una domanda alla visita.");
        return;
    }

    if (questionCount > 0 && !getGroupVisit()) {
        alert("Le sezioni-domanda richiedono di attivare Visita di gruppo.");
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
        type: getGroupVisit() ? "synchronized" : "standard",
        length: document.getElementById('v-length')?.value || "normal"
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
