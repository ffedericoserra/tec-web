const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token") || localStorage.getItem("artaround_token");
const CONTENT_PLACEHOLDER = "/uploads/placeholders/template-no-image.jpg";

// Etichette leggibili per la scheda-opera nell'accordion della tappa —
// tradotte a runtime tramite le chiavi i18n condivise col resto del sito,
// non un dizionario italiano fisso.
const CONTENT_TYPE_I18N_KEYS = {
    Artwork: 'items.typeArtwork',
    Artist: 'items.typeArtist',
    Movement: 'items.typeMovement',
    Place: 'items.typePlace'
};

const TARGET_AUDIENCE_I18N_KEYS = {
    general: 'itemEditor.audienceGeneral',
    children: 'itemEditor.audienceChildren',
    student: 'itemEditor.audienceStudents',
    expert: 'itemEditor.audienceExperts',
    tourist: 'itemEditor.audienceTourists'
};

function contentTypeLabel(type) {
    const key = CONTENT_TYPE_I18N_KEYS[type];
    return key ? marketplaceT(key) : '';
}

function targetAudienceLabel(audience) {
    const key = TARGET_AUDIENCE_I18N_KEYS[audience];
    return key ? marketplaceT(key) : '';
}

if (!token) {
    alert(marketplaceT("errors.authRequired"));
    window.location.href = "../pages/login.html";
}

const urlParams = new URLSearchParams(window.location.search);
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName') || marketplaceT('common.museum');
const visitId = urlParams.get('visitId');
const STRUCTURE_TAG = "[Struttura Blocchi Salvata: ";

// Diamo "memoria" al pulsante Back to Museum page
const backToMuseumBtn = document.getElementById('back-to-museum-btn');
if (backToMuseumBtn) {
    // Aggiorniamo l'href dinamicamente inserendo l'ID che abbiamo appena letto
    backToMuseumBtn.href = `visits_list.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
}

const displayMuseumEl = document.getElementById('display-museum-name');
if (displayMuseumEl) displayMuseumEl.innerText = museumName || marketplaceT('visitEditor.noMuseum');

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
let itemModalReturnFocus = null;
let itemModalRequestId = 0;
let currentWalletBalance = 0;
let itemCatalog = {};
let museumContentsCache = [];
let itemCatalogReady = false;
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
        visitVisibilityStatus.textContent = isPublic
            ? marketplaceT("common.public")
            : marketplaceT("common.private");
    }

    if (visitVisibilityHint) {
        visitVisibilityHint.textContent = isPublic
            ? marketplaceT("visitEditor.publicHint")
            : marketplaceT("visitEditor.privateHint");
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
        visitGroupStatus.textContent = enabled
            ? marketplaceT("visitEditor.group")
            : marketplaceT("visitEditor.standard");
    }
    if (visitGroupHint) {
        visitGroupHint.textContent = enabled
            ? marketplaceT("visitEditor.groupEnabled")
            : marketplaceT("visitEditor.enableGroup");
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

        if (!res.ok) throw new Error(marketplaceT("visitEditor.walletLoadError"));

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

function calculatePendingVisitCostForCounts(currentCounts) {
    let total = 0;

    Object.entries(currentCounts).forEach(([itemId, currentCount]) => {
        const previousCount = originalVisitItemCounts[itemId] || 0;
        if (currentCount > previousCount && previousCount === 0) {
            total += Number(itemCatalog[itemId]?.adoptionPrice) || 0;
        }
    });

    return total;
}

function calculatePendingVisitCost() {
    return calculatePendingVisitCostForCounts(countVisitItemsFromDom());
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

function canAffordItemSelection(itemNode, itemId) {
    const currentCounts = countVisitItemsFromDom();
    const currentItemId = itemNode?.dataset.itemId || '';

    if (currentItemId && currentCounts[currentItemId]) {
        currentCounts[currentItemId]--;
        if (currentCounts[currentItemId] <= 0) delete currentCounts[currentItemId];
    }
    if (itemId) currentCounts[itemId] = (currentCounts[itemId] || 0) + 1;

    return calculatePendingVisitCostForCounts(currentCounts) <= currentWalletBalance;
}

function refreshModalItemAvailability() {
    document.querySelectorAll('.draggable-item').forEach(populateItemChoiceSelect);
    updateWalletPreview();
}

function getContentByUniversalId(contentId) {
    return museumContentsCache.find((content) => content.universalId === contentId) || null;
}

function getItemChoicesForContent(contentId) {
    const ownershipRank = (itemInfo) => itemInfo.isOwned ? 0 : itemInfo.isPurchased ? 1 : 2;
    return Object.entries(itemCatalog)
        .filter(([, itemInfo]) => itemInfo.contentId === contentId)
        .sort(([, left], [, right]) => {
            const rankDifference = ownershipRank(left) - ownershipRank(right);
            if (rankDifference !== 0) return rankDifference;
            return (Number(left.adoptionPrice) || 0) - (Number(right.adoptionPrice) || 0);
        });
}

function itemPricePresentation(itemInfo) {
    const price = Number(itemInfo?.adoptionPrice ?? itemInfo?.price) || 0;
    if (!itemInfo) {
        return { label: marketplaceT('visitEditor.chooseItem'), className: 'is-free' };
    }
    if (itemInfo.isOwned) {
        return { label: marketplaceT('visitEditor.owned'), className: 'is-free' };
    }
    if (itemInfo.isPurchased) {
        return { label: marketplaceT('visitEditor.acquired'), className: 'is-free' };
    }
    return {
        label: price > 0 ? formatCurrencyAmount(price) : marketplaceT('visitEditor.free'),
        className: price > 0 ? 'is-paid' : 'is-free'
    };
}

function itemChoiceLabel(itemInfo) {
    const price = itemPricePresentation(itemInfo).label;
    return [
        itemInfo.creatorName,
        targetAudienceLabel(itemInfo.targetAudience || 'general'),
        itemInfo.license,
        price
    ].filter(Boolean).join(' · ');
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
        throw new Error(marketplaceT("visitEditor.catalogLoadError"));
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
    itemCatalogReady = true;

    return itemCatalog;
}

const blocksContainer = document.getElementById('blocks-container');
const addBlockBtnWrapper = document.getElementById('add-block-btn');
const chapterTabsList = document.getElementById('chapter-tabs');
let blockCounter = 0;
let questionEditorCounter = 0;
let blockUidSeed = 0;

function generateBlockUid() {
    blockUidSeed += 1;
    return `chapter-${Date.now()}-${blockUidSeed}`;
}

// --- SCHEDE CAPITOLO (una alla volta, come le pagine di un documento) ---
// Ogni sezione resta sempre nel DOM (stato ed eventi non vanno persi), ma
// solo quella con .is-active-block è visibile: niente più scorrimento
// orizzontale, si passa da un capitolo all'altro cliccando la sua scheda.
function getChapterTabLabel(block, index) {
    const isQuestions = block.dataset.sectionType === 'questions';
    const titleInput = block.querySelector('.block-title-input');
    const title = titleInput?.value?.trim()
        || (isQuestions ? marketplaceT('visitEditor.questionsDefault') : marketplaceT('visitEditor.newChapter'));
    return { number: toRoman(index + 1), title };
}

function renderChapterTabs() {
    if (!chapterTabsList) return;
    chapterTabsList.querySelectorAll('.chapter-tab').forEach((tab) => tab.remove());

    const blocks = Array.from(blocksContainer.querySelectorAll('.visit-block'));
    blocks.forEach((block, index) => {
        const isActive = block.classList.contains('is-active-block');
        const { number, title } = getChapterTabLabel(block, index);

        const tab = document.createElement('button');
        tab.type = 'button';
        tab.classList.add('chapter-tab');
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        tab.title = title;
        tab.innerHTML = `
            <span class="chapter-tab-number">${number}</span>
            <span class="chapter-tab-title">${escapeHTML(title)}</span>
        `;
        tab.addEventListener('click', () => setActiveBlock(block));
        chapterTabsList.insertBefore(tab, addBlockBtnWrapper);
    });
}

function setActiveBlock(block) {
    blocksContainer.querySelectorAll('.visit-block').forEach((candidate) => {
        candidate.classList.toggle('is-active-block', candidate === block);
    });
    renderChapterTabs();
}

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
    correctInput.setAttribute('aria-label', marketplaceT('visitEditor.setCorrectAria'));

    const correctText = document.createElement('span');
    correctText.textContent = marketplaceT('visitEditor.correct');
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
    input.placeholder = marketplaceT('visitEditor.answerOption');
    input.value = value;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.classList.add('delete-option-btn');
    deleteButton.setAttribute('aria-label', marketplaceT('visitEditor.removeOptionAria'));
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
    typeSelect.setAttribute('aria-label', marketplaceT('visitEditor.answerTypeAria'));
    typeSelect.querySelector('option[value="open"]').textContent = marketplaceT('visitEditor.openAnswer');
    typeSelect.querySelector('option[value="multiple-choice"]').textContent = marketplaceT('visitEditor.multipleChoice');
    editor.querySelector('.delete-question-btn').setAttribute(
        'aria-label',
        marketplaceT('visitEditor.removeQuestionAria')
    );
    const prompt = editor.querySelector('.question-prompt');
    prompt.placeholder = marketplaceT('visitEditor.questionPlaceholder');
    prompt.setAttribute('aria-label', marketplaceT('visitEditor.questionAria'));
    editor.querySelector('.add-question-option').textContent = marketplaceT('visitEditor.addOption');
    editor.querySelectorAll('.question-option-row').forEach((row) => {
        const existingControl = row.querySelector('.question-correct-option');
        if (existingControl) {
            existingControl.name = `correct-option-${getQuestionEditorId(editor)}`;
            existingControl.setAttribute('aria-label', marketplaceT('visitEditor.setCorrectAria'));
            row.querySelector('.question-correct-label span').textContent = marketplaceT('visitEditor.correct');
        } else {
            row.prepend(createCorrectOptionControl(editor));
        }
        row.querySelector('.question-option-input').placeholder = marketplaceT('visitEditor.answerOption');
        row.querySelector('.delete-option-btn').setAttribute(
            'aria-label',
            marketplaceT('visitEditor.removeOptionAria')
        );
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
            <select class="question-answer-type" aria-label="${marketplaceT('visitEditor.answerTypeAria')}">
                <option value="open">${marketplaceT('visitEditor.openAnswer')}</option>
                <option value="multiple-choice">${marketplaceT('visitEditor.multipleChoice')}</option>
            </select>
            <button type="button" class="delete-question-btn" aria-label="${marketplaceT('visitEditor.removeQuestionAria')}">&times;</button>
        </div>
        <textarea class="question-prompt" placeholder="${marketplaceT('visitEditor.questionPlaceholder')}" aria-label="${marketplaceT('visitEditor.questionAria')}"></textarea>
        <div class="question-options-editor">
            <div class="question-options-list"></div>
            <button type="button" class="add-question-option">${marketplaceT('visitEditor.addOption')}</button>
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
    const deleteButton = block.querySelector('.delete-block-btn');
    const deleteLabel = marketplaceT('visitEditor.removeSectionAria');
    deleteButton.title = deleteLabel;
    deleteButton.setAttribute('aria-label', deleteLabel);
    deleteButton.addEventListener('click', () => {
        const message = block.dataset.sectionType === 'questions'
            ? marketplaceT('visitEditor.deleteQuestionSection')
            : marketplaceT('visitEditor.deleteArtworkSection');
        if (confirm(message)) {
            const wasActive = block.classList.contains('is-active-block');
            block.remove();
            if (wasActive) {
                // La scheda attiva è sparita: apriamo quella rimasta più a
                // sinistra, cosi la vista a scheda-singola non resta vuota.
                setActiveBlock(blocksContainer.querySelector('.visit-block'));
            } else {
                renderChapterTabs();
            }
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

    const label = isQuestionBlock
        ? marketplaceT('visitEditor.addQuestion')
        : marketplaceT('visitEditor.addContent');
    button.classList.add('add-btn', 'block-add-btn');
    button.textContent = '';
    button.dataset.tooltip = label;
    button.setAttribute('aria-label', label);
    button.removeAttribute('title');
}

function createNewBlock(defaultTitle = marketplaceT("visitEditor.newChapter"), sectionType = "artwork", questions = []) {
    blockCounter++;
    const block = document.createElement('div');
    block.classList.add('visit-block');
    block.dataset.sectionType = sectionType;
    block.dataset.blockUid = generateBlockUid();

    const sectionBody = sectionType === 'questions'
        ? `<div class="question-list"></div>
           <div class="block-footer">
             <button class="add-btn block-add-btn add-question-to-block" type="button" aria-label="${marketplaceT('visitEditor.addQuestion')}" data-tooltip="${marketplaceT('visitEditor.addQuestion')}"></button>
           </div>`
        : `<ul class="block-list"></ul>
           <div class="block-footer">
             <button class="add-btn block-add-btn add-item-to-block" type="button" aria-label="${marketplaceT('visitEditor.addContent')}" data-tooltip="${marketplaceT('visitEditor.addContent')}"></button>
           </div>`;

    block.innerHTML = `
      <div class="block-header">
        <span class="block-number">${marketplaceT('visitEditor.chapter', { number: toRoman(blockCounter) })}</span>
        <input type="text" class="block-title-input" value="${escapeHTML(defaultTitle)}">
        <span class="block-count">${sectionType === 'questions'
            ? marketplaceT('visitEditor.blockQuestions', { count: 0 })
            : marketplaceT('visitEditor.blockArtworks', { count: 0 })}</span>
        <button class="delete-block-btn" type="button" title="${marketplaceT('visitEditor.removeSectionAria')}" aria-label="${marketplaceT('visitEditor.removeSectionAria')}">&times;</button>
      </div>
      ${sectionBody}
    `;

    normalizeBlockAddButton(block);
    bindBlockDelete(block);
    block.querySelector('.block-title-input').addEventListener('input', renderChapterTabs);

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

    blocksContainer.appendChild(block);
    setActiveBlock(block);
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
            sectionType === 'questions'
                ? marketplaceT('visitEditor.questionsDefault')
                : marketplaceT('visitEditor.newChapter'),
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
        block.querySelector('.block-number').textContent = marketplaceT('visitEditor.chapter', {
            number: toRoman(index + 1)
        });
        const isQuestions = block.dataset.sectionType === 'questions';
        const count = isQuestions
            ? block.querySelectorAll('.question-editor').length
            : block.querySelectorAll('.draggable-item').length;
        block.querySelector('.block-count').textContent = isQuestions
            ? marketplaceT('visitEditor.blockQuestions', { count })
            : marketplaceT('visitEditor.blockArtworks', { count });
    });
    renderChapterTabs();
    updateWalletPreview();
    refreshModalItemAvailability();
}

// --- PICKER CONTENT: l'Item viene scelto dopo, nella riga della visita ---
async function apriModaleOpere(itemToReplace = null) {
    const requestId = ++itemModalRequestId;
    const wasClosed = itemModal.classList.contains('hidden');
    if (wasClosed) itemModalReturnFocus = document.activeElement;
    pendingItemReplacement = itemToReplace;
    itemModal.classList.remove('hidden');
    itemsContainer.innerHTML = renderBuilderMessage(marketplaceT("items.loadingContents"));
    updateWalletPreview();
    const modalPanel = itemModal.querySelector('.visit-builder-modal');
    if (wasClosed) modalPanel?.focus();

    try {
        await loadMuseumItemCatalog(true);
        if (requestId !== itemModalRequestId || itemModal.classList.contains('hidden')) return;
        hydrateVisitItemChoices();

        itemsContainer.innerHTML = '';
        if (museumContentsCache.length > 0) {
            museumContentsCache.forEach((content) => {
                if (!content.universalId) return;

                const itemDiv = document.createElement('button');
                itemDiv.type = 'button';
                itemDiv.classList.add('modal-artwork-item');
                itemDiv.dataset.contentId = content.universalId;
                const contentTitle = content.name || marketplaceT('common.content');
                const addContentLabel = marketplaceT('visitEditor.addContentToVisit', {
                    title: contentTitle
                });
                itemDiv.title = addContentLabel;
                itemDiv.setAttribute('aria-label', addContentLabel);

                const imageUrl = contentImagePath(content);
                const finalImgUrl = resolveAssetUrl(imageUrl);
                const imgTag = finalImgUrl
                    ? `<img src="${escapeHTML(finalImgUrl)}" alt="" class="modal-artwork-image">`
                    : '<span class="image-fallback">IMG</span>';
                const itemCount = getItemChoicesForContent(content.universalId).length;

                itemDiv.innerHTML = `
                    <div class="modal-artwork-media">${imgTag}</div>
                    <div class="modal-artwork-footer">
                        <strong class="card-title">${escapeHTML(content.name || marketplaceT('common.content'))}</strong>
                        <span class="modal-content-author">${escapeHTML(content.author || marketplaceT('common.authorUnknown'))}</span>
                        <div class="card-meta-row">
                            <span class="meta-pill meta-pill-author">${escapeHTML(contentTypeLabel(content.type))}</span>
                            <span class="meta-pill meta-pill-count">${escapeHTML(marketplaceT('visitEditor.availableItems', { count: itemCount }))}</span>
                        </div>
                    </div>
                `;

                itemDiv.querySelectorAll('.modal-artwork-image').forEach((img) => {
                    img.addEventListener('error', () => img.classList.add('is-hidden'));
                });

                itemDiv.onclick = () => {
                    const replacement = pendingItemReplacement;
                    const selectedItemId = replacement?.dataset.contentId === content.universalId
                        ? replacement.dataset.itemId || ''
                        : '';
                    const visitItem = creaEdAggiungiItem(
                        content.name || marketplaceT('common.content'),
                        selectedItemId,
                        activeBlockList,
                        imageUrl,
                        content.author || marketplaceT('common.authorUnknown'),
                        content.universalId,
                        replacement?.dataset.nextDirections || '',
                        replacement?.dataset.prevDirections || '',
                        replacement
                    );
                    const itemSelect = visitItem.querySelector('.item-choice-select');
                    closeItemPicker(itemSelect?.disabled
                        ? visitItem.querySelector('.edit-item-btn')
                        : itemSelect);
                };
                itemsContainer.appendChild(itemDiv);
            });
            if (!itemModal.contains(document.activeElement) || document.activeElement === modalPanel) {
                itemsContainer.querySelector('.modal-artwork-item')?.focus();
            }
        } else {
            itemsContainer.innerHTML = renderBuilderMessage(marketplaceT("visitEditor.noContents"));
            document.getElementById('close-item-modal')?.focus();
        }
    } catch (err) {
        if (requestId !== itemModalRequestId || itemModal.classList.contains('hidden')) return;
        itemsContainer.innerHTML = renderBuilderMessage(marketplaceT("visitEditor.connectionError"), true);
        document.getElementById('close-item-modal')?.focus();
    }
}

function closeItemPicker(nextFocus = null) {
    const focusTarget = nextFocus || itemModalReturnFocus;
    itemModalRequestId++;
    pendingItemReplacement = null;
    itemModal.classList.add('hidden');
    itemModalReturnFocus = null;
    if (focusTarget?.isConnected) {
        requestAnimationFrame(() => focusTarget.focus());
    }
}

document.getElementById('close-item-modal').addEventListener('click', () => closeItemPicker());
itemModal.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeItemPicker();
});

// --- DRAG & DROP INCROCIATO & CREAZIONE CARTA ---
let draggedItem = null;
let dragSourceList = null;
const boundArtworkItems = new WeakSet();
const boundItemChoiceSelects = new WeakSet();
let placeholder = document.createElement('li');
placeholder.classList.add('placeholder');

function getArtworkItems(listElement) {
    return Array.from(listElement?.children || []).filter((node) =>
        node.classList.contains('draggable-item')
    );
}

// Ogni item porta con sé le proprie "indicazioni verso la tappa successiva":
// il pannello a bordo carta viene ricalcolato ad ogni modifica dell'ordine,
// mentre il riepilogo in cima alla sezione mostra l'intero percorso A → B → C.
function ensureRoutePanel(item) {
    // Il pannello vive dentro il corpo a comparsa della fisarmonica, accanto
    // alla carta con l'immagine intera, non come figlio diretto dell'item.
    const body = item.querySelector(':scope > .item-accordion-collapse > .item-accordion-body') || item;
    let panel = body.querySelector(':scope > .item-route-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.classList.add('item-route-panel');
        body.appendChild(panel);
    }
    return panel;
}

function renderRoutePanel(item, nextItem) {
    const panel = ensureRoutePanel(item);

    if (!nextItem) {
        panel.classList.add('is-end');
        panel.innerHTML = `<span class="item-route-end">${marketplaceT('visitEditor.endChapter')}</span>`;
        return;
    }

    panel.classList.remove('is-end');
    const nextTitle = nextItem.dataset.title || marketplaceT('visitEditor.nextArtwork');

    let textarea = panel.querySelector('.direction-field');
    if (!textarea) {
        panel.innerHTML = `
            <span class="item-route-label">${marketplaceT('visitEditor.directionsToward')}</span>
            <span class="item-route-target"></span>
            <textarea class="direction-field" rows="3"></textarea>
        `;
        textarea = panel.querySelector('.direction-field');
        textarea.value = item.dataset.nextDirections || '';
    }

    // Il campo può già esistere (es. dopo un ripristino dallo stato
    // temporaneo): assicuriamoci comunque che l'ascoltatore sia agganciato.
    if (textarea.dataset.bound !== 'true') {
        textarea.dataset.bound = 'true';
        textarea.addEventListener('input', () => {
            item.dataset.nextDirections = textarea.value;
            if (item.nextRouteItem) item.nextRouteItem.dataset.prevDirections = textarea.value;
        });
    }

    panel.querySelector('.item-route-target').textContent = nextTitle;
    textarea.placeholder = marketplaceT('visitEditor.directionsPlaceholder', { title: nextTitle });
    textarea.setAttribute('aria-label', marketplaceT('visitEditor.directionsAria', { title: nextTitle }));

    item.nextRouteItem = nextItem;
    nextItem.dataset.prevDirections = item.dataset.nextDirections || textarea.value || '';
}

function renderSectionRouteOverview(listElement, items) {
    const block = listElement?.closest('.visit-block');
    if (!block) return;

    let overview = block.querySelector('.section-route-overview');
    if (items.length === 0) {
        overview?.remove();
        return;
    }

    if (!overview) {
        overview = document.createElement('div');
        overview.classList.add('section-route-overview');
        block.insertBefore(overview, listElement);
    }

    const stops = items.map((item, index) => `
        <span class="route-overview-stop">
            <span class="route-overview-index">${index + 1}</span>
            <span class="route-overview-name">${escapeHTML(item.dataset.title || marketplaceT('visitEditor.artwork'))}</span>
        </span>
    `).join('<span class="route-overview-arrow" aria-hidden="true">&rarr;</span>');

    overview.innerHTML = `
        <span class="route-overview-label">${marketplaceT('visitEditor.chapterRoute')}</span>
        <div class="route-overview-path">${stops}</div>
    `;
}

function refreshRouteConnectors(listElement) {
    if (!listElement) return;

    const items = getArtworkItems(listElement);
    if (items.length > 0) items[0].dataset.prevDirections = '';
    items.forEach((item, index) => renderRoutePanel(item, items[index + 1] || null));
    renderSectionRouteOverview(listElement, items);
}

function ensureItemChoiceControl(item) {
    let select = item.querySelector('.item-choice-select');
    if (select) return select;

    const actions = item.querySelector('.item-toggle-actions');
    if (!actions) return null;

    const label = document.createElement('label');
    label.classList.add('item-choice-control');
    label.setAttribute('draggable', 'false');
    label.innerHTML = `
        <span class="item-choice-label">${marketplaceT('visitEditor.itemLabel')}</span>
        <select class="item-choice-select"></select>
    `;
    actions.prepend(label);
    select = label.querySelector('.item-choice-select');
    return select;
}

function populateItemChoiceSelect(item) {
    const select = ensureItemChoiceControl(item);
    if (!select) return;

    if (!itemCatalogReady) {
        if (select.options.length === 0) {
            const loadingOption = document.createElement('option');
            loadingOption.value = '';
            loadingOption.textContent = marketplaceT('visitEditor.loadingItems');
            select.appendChild(loadingOption);
        }
        select.disabled = true;
        select.required = false;
        select.setAttribute('aria-required', 'false');
        select.setAttribute('aria-busy', 'true');
        return;
    }
    select.removeAttribute('aria-busy');

    const selectedItemId = item.dataset.itemId || '';
    const choices = getItemChoicesForContent(item.dataset.contentId || '');
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = choices.length > 0
        ? marketplaceT('visitEditor.chooseItem')
        : marketplaceT('visitEditor.noAvailableItems');
    placeholder.disabled = choices.length > 0;
    select.replaceChildren(placeholder);

    const baseLabels = choices.map(([, itemInfo]) => itemChoiceLabel(itemInfo));
    const labelTotals = baseLabels.reduce((totals, label) => {
        totals.set(label, (totals.get(label) || 0) + 1);
        return totals;
    }, new Map());
    const labelOccurrences = new Map();

    choices.forEach(([itemId, itemInfo], index) => {
        const option = document.createElement('option');
        const baseLabel = baseLabels[index];
        const labelOccurrence = (labelOccurrences.get(baseLabel) || 0) + 1;
        labelOccurrences.set(baseLabel, labelOccurrence);
        option.value = itemId;
        option.textContent = labelTotals.get(baseLabel) > 1
            ? `${baseLabel} · ${marketplaceT('visitEditor.itemVariant', {
                count: labelOccurrence
            })}`
            : baseLabel;
        const canAfford = canAffordItemSelection(item, itemId);
        option.disabled = itemId !== selectedItemId && !canAfford;
        if (option.disabled) {
            option.textContent += ` · ${marketplaceT('visitEditor.insufficientBalance')}`;
        }
        select.appendChild(option);
    });

    select.value = selectedItemId;
    if (itemCatalogReady && select.value !== selectedItemId) {
        item.dataset.itemId = '';
        select.value = '';
        updateItemSpecificRow(item);
    }
    select.disabled = choices.length === 0;
    select.required = choices.length > 0;
    select.setAttribute('aria-required', choices.length > 0 ? 'true' : 'false');
    select.setAttribute('aria-label', marketplaceT('visitEditor.chooseItemForContent', {
        title: item.dataset.title || marketplaceT('common.content')
    }));
    select.title = choices.length === 0
        ? marketplaceT('visitEditor.createItemFirst')
        : marketplaceT('visitEditor.chooseItemForContent', {
            title: item.dataset.title || marketplaceT('common.content')
        });
}

function updateItemSpecificRow(item) {
    const itemInfo = itemCatalog[item.dataset.itemId] || null;
    const price = itemPricePresentation(itemInfo);
    const contentTitle = item.dataset.title || marketplaceT('common.content');

    item.querySelectorAll('.meta-pill-price, .item-info-price').forEach((element) => {
        element.textContent = price.label;
        element.classList.toggle('is-paid', price.className === 'is-paid');
        element.classList.toggle('is-free', price.className === 'is-free');
    });

    const creator = item.querySelector('.item-info-creator');
    if (creator) creator.textContent = itemInfo?.creatorName || '—';
    const license = item.querySelector('.item-info-license');
    if (license) license.textContent = itemInfo?.license || '—';
    const target = item.querySelector('.item-info-target');
    if (target) {
        target.textContent = itemInfo
            ? targetAudienceLabel(itemInfo.targetAudience || 'general')
            : '—';
    }

    const editorLabel = marketplaceT(
        itemInfo ? 'visitEditor.editItemForContent' : 'visitEditor.createItemForContent',
        { title: contentTitle }
    );
    [item.querySelector('.item-open-editor'), item.querySelector('.edit-item-btn')]
        .filter(Boolean)
        .forEach((control) => {
            control.title = editorLabel;
            control.setAttribute('aria-label', editorLabel);
        });

    const replaceButton = item.querySelector('.replace-item-btn');
    if (replaceButton) {
        const replaceLabel = marketplaceT('visitEditor.changeContentFor', { title: contentTitle });
        replaceButton.title = replaceLabel;
        replaceButton.setAttribute('aria-label', replaceLabel);
    }
    const deleteButton = item.querySelector('.delete-btn');
    if (deleteButton) {
        const deleteLabel = marketplaceT('visitEditor.removeContentFromVisit', {
            title: contentTitle
        });
        deleteButton.title = deleteLabel;
        deleteButton.setAttribute('aria-label', deleteLabel);
    }
}

function bindItemChoiceControl(item) {
    const select = ensureItemChoiceControl(item);
    if (!select) return;

    populateItemChoiceSelect(item);
    if (boundItemChoiceSelects.has(select)) return;
    boundItemChoiceSelects.add(select);
    select.removeAttribute('data-bound');

    select.addEventListener('mousedown', (event) => event.stopPropagation());
    select.addEventListener('pointerdown', () => {
        item.dataset.suppressDrag = 'true';
    });
    ['pointerup', 'pointercancel', 'blur'].forEach((eventName) => {
        select.addEventListener(eventName, () => delete item.dataset.suppressDrag);
    });
    select.addEventListener('dragstart', (event) => {
        event.preventDefault();
        event.stopPropagation();
    });
    select.addEventListener('change', () => {
        delete item.dataset.suppressDrag;
        const previousItemId = item.dataset.itemId || '';
        const nextItemId = select.value;
        if (nextItemId && !canAffordItemSelection(item, nextItemId)) {
            alert(marketplaceT('visitEditor.insufficientBalance'));
            select.value = previousItemId;
            return;
        }

        item.dataset.itemId = nextItemId;
        updateItemSpecificRow(item);
        refreshModalItemAvailability();
    });
}

function hydrateVisitItemChoices() {
    document.querySelectorAll('.draggable-item').forEach((item) => {
        bindItemChoiceControl(item);
        if (itemCatalogReady) updateItemSpecificRow(item);
    });
    refreshModalItemAvailability();
}

function openItemEditor(item) {
    salvaStatoTemporaneo();

    const params = new URLSearchParams({
        museumId,
        museumName,
        source: 'visit',
        title: item.dataset.title || marketplaceT('visitEditor.artwork'),
        author: item.dataset.author || marketplaceT('common.authorUnknown'),
        image: item.dataset.imageUrl || ''
    });
    if (item.dataset.itemId) params.set('itemId', item.dataset.itemId);
    if (visitId) params.set('visitId', visitId);
    if (item.dataset.contentId) params.set('contentId', item.dataset.contentId);
    window.location.href = `create_items.html?${params.toString()}`;
}

function bindArtworkItem(item) {
    if (boundArtworkItems.has(item)) return;
    boundArtworkItems.add(item);

    item.querySelectorAll('.draggable-item-image').forEach((image) => {
        image.addEventListener('error', () => image.classList.add('is-hidden'));
    });

    // Cliccando sulla riga si apre l'editor testi dell'item (create_items.html);
    // la "linguetta" con l'immagine intera e le indicazioni si abbassa invece
    // solo al passaggio del mouse (o al focus da tastiera), via CSS :hover.
    const header = item.querySelector('.item-accordion-header');
    const openControl = item.querySelector('.item-open-editor') || header;
    openControl.setAttribute('aria-label', marketplaceT('visitEditor.editTextsAria'));
    [
        ['.edit-item-btn', 'visitEditor.editTexts'],
        ['.replace-item-btn', 'visitEditor.changeContent'],
        ['.drag-handle', 'visitEditor.reorder'],
        ['.delete-btn', 'visitEditor.removeContent']
    ].forEach(([selector, key]) => {
        const button = item.querySelector(selector);
        if (!button) return;
        const label = marketplaceT(key);
        button.title = label;
        button.setAttribute('aria-label', label);
    });

    if (openControl.classList.contains('item-open-editor')) {
        openControl.addEventListener('click', () => openItemEditor(item));
    } else {
        header.addEventListener('click', (event) => {
            if (event.target.closest('button, input, textarea, select, a')) return;
            openItemEditor(item);
        });
        header.addEventListener('keydown', (event) => {
            if ((event.key === 'Enter' || event.key === ' ') && event.target === header) {
                event.preventDefault();
                openItemEditor(item);
            }
        });
    }

    bindItemChoiceControl(item);
    if (itemCatalogReady) updateItemSpecificRow(item);

    item.querySelector('.delete-btn').addEventListener('click', () => {
        const listElement = item.parentElement;
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

    item.addEventListener('dragstart', (event) => {
        const startedFromControl = event.target.closest(
            '.item-choice-control, input, textarea, select, a, button:not(.drag-handle)'
        );
        if (event.defaultPrevented || item.dataset.suppressDrag === 'true' || startedFromControl) {
            event.preventDefault();
            return;
        }
        draggedItem = item;
        dragSourceList = item.parentElement;
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

        refreshRouteConnectors(dragSourceList);
        if (destinationList !== dragSourceList) refreshRouteConnectors(destinationList);
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
    author = marketplaceT("common.authorUnknown"),
    contentId = "",
    nextDirections = "",
    prevDirections = "",
    itemToReplace = null
) {
    const content = getContentByUniversalId(contentId);
    const contentTitle = content?.name || titoloOpera || marketplaceT('common.content');
    const contentAuthor = content?.author || author || marketplaceT('common.authorUnknown');
    const contentImage = content ? contentImagePath(content) : imageUrl;
    const contentYear = content?.year || itemCatalog[itemId]?.year || '—';
    const contentType = content?.type || itemCatalog[itemId]?.contentType || '';

    const li = document.createElement('li');
    li.classList.add('draggable-item');
    li.setAttribute('draggable', 'true');
    li.dataset.itemId = itemId || '';
    li.dataset.title = contentTitle;
    li.dataset.author = contentAuthor;
    li.dataset.imageUrl = contentImage || '';
    li.dataset.contentId = contentId || "";
    li.dataset.nextDirections = nextDirections || "";
    li.dataset.prevDirections = prevDirections || "";

    // Risolviamo il percorso dell'immagine
    const finalImgUrl = resolveAssetUrl(contentImage);
    const imgTag = finalImgUrl
        ? `<img src="${escapeHTML(finalImgUrl)}" alt="${escapeHTML(contentTitle)}" class="draggable-item-image">`
        : '<span class="image-fallback">IMG</span>';

    const itemInfo = itemCatalog[itemId] || null;
    const pricePresentation = itemPricePresentation(itemInfo);
    const priceLabel = pricePresentation.label;
    const priceClass = pricePresentation.className;

    // La scheda mostra i dati stabili del Content e aggiorna i metadati
    // specifici dell'Item quando cambia la scelta nel menu a tendina.
    const typeLabel = contentTypeLabel(contentType) || contentType || '—';
    const creatorLabel = itemInfo?.creatorName || '—';
    const licenseLabel = itemInfo?.license || '—';
    const targetLabel = itemInfo
        ? targetAudienceLabel(itemInfo.targetAudience || 'general')
        : '—';

    li.innerHTML = `
        <div class="item-accordion-header">
            <button type="button" class="item-open-editor" aria-label="${escapeHTML(marketplaceT('visitEditor.editTextsAria'))}">
                <span class="item-toggle-thumb">${imgTag}</span>
                <span class="item-toggle-info">
                    <strong class="card-title">${escapeHTML(contentTitle)}</strong>
                    <span class="card-meta-row">
                        <span class="meta-pill meta-pill-author">${escapeHTML(contentAuthor)}</span>
                        <span class="meta-pill meta-pill-price ${priceClass}">${escapeHTML(priceLabel)}</span>
                    </span>
                </span>
            </button>
            <span class="item-toggle-actions">
                <button type="button" class="edit-item-btn" title="${marketplaceT('visitEditor.editTexts')}" aria-label="${marketplaceT('visitEditor.editTexts')}">&#9998;</button>
                <button type="button" class="replace-item-btn" title="${marketplaceT('visitEditor.changeContent')}" aria-label="${marketplaceT('visitEditor.changeContent')}">&#8644;</button>
                <button type="button" class="drag-handle" title="${marketplaceT('visitEditor.reorder')}" aria-label="${marketplaceT('visitEditor.reorder')}">
                    <span class="drag-handle-dots" aria-hidden="true">
                        <span></span><span></span><span></span><span></span><span></span><span></span>
                    </span>
                </button>
                <button type="button" class="delete-btn" title="${marketplaceT('visitEditor.removeContent')}" aria-label="${marketplaceT('visitEditor.removeContent')}">&times;</button>
            </span>
            <span class="item-toggle-chevron" aria-hidden="true"></span>
        </div>
        <div class="item-accordion-collapse">
            <div class="item-accordion-body">
                <div class="artwork-card">
                    ${imgTag}
                    <div class="artwork-card-scrim"></div>
                    <div class="artwork-card-info">
                        <strong class="card-title">${escapeHTML(contentTitle)}</strong>
                    </div>
                </div>
                <dl class="item-info-panel">
                    <span class="item-info-heading">${marketplaceT('visitEditor.infoCardHeading')}</span>
                    <div class="item-info-row">
                        <dt>${marketplaceT('common.author')}</dt>
                        <dd>${escapeHTML(contentAuthor)}</dd>
                    </div>
                    <div class="item-info-row">
                        <dt>${marketplaceT('itemEditor.year')}</dt>
                        <dd>${escapeHTML(contentYear)}</dd>
                    </div>
                    <div class="item-info-row">
                        <dt>${marketplaceT('visitEditor.infoType')}</dt>
                        <dd>${escapeHTML(typeLabel)}</dd>
                    </div>
                    <div class="item-info-row">
                        <dt>${marketplaceT('itemEditor.itemAuthor')}</dt>
                        <dd class="item-info-creator">${escapeHTML(creatorLabel)}</dd>
                    </div>
                    <div class="item-info-row">
                        <dt>${marketplaceT('itemEditor.license')}</dt>
                        <dd class="item-info-license">${escapeHTML(licenseLabel)}</dd>
                    </div>
                    <div class="item-info-row">
                        <dt>${marketplaceT('itemEditor.target')}</dt>
                        <dd class="item-info-target">${escapeHTML(targetLabel)}</dd>
                    </div>
                    <div class="item-info-row item-info-row-price">
                        <dt>${marketplaceT('itemEditor.price')}</dt>
                        <dd class="item-info-price ${priceClass}">${escapeHTML(priceLabel)}</dd>
                    </div>
                </dl>
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
    return li;
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

    const activeBlock = blocksContainer.querySelector('.visit-block.is-active-block');
    const activeBlockUid = activeBlock?.dataset.blockUid || null;

    const blocksHtmlNodes = Array.from(blocksContainer.querySelectorAll('.visit-block'));
    blocksHtmlNodes.forEach((block) => {
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
        activeBlockUid: activeBlockUid,
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
            blockName: block.blockName || block.title || marketplaceT('visitEditor.stop', { count: index + 1 }),
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
        ? [{ type: 'artwork', blockName: marketplaceT("visitEditor.firstStop"), items: sequenceItems, questions: [] }]
        : [];
}

function getItemTitle(item, relatedContent) {
    return relatedContent?.name || item?.descriptions?.[0]?.title || marketplaceT("visitEditor.artwork");
}

function createItemInfo(item, museumContents) {
    const relatedContent = museumContents.find(c => c.universalId === item.contentId);

    return {
        title: getItemTitle(item, relatedContent),
        author: relatedContent?.author || marketplaceT("common.authorUnknown"),
        creatorName: item.creatorId?.username
            || item.creatorName
            || marketplaceT('itemEditor.unknownUser'),
        year: relatedContent?.year || "",
        contentType: relatedContent?.type || "",
        imageUrl: contentImagePath(relatedContent),
        contentId: item.contentId || "",
        price: Number(item.price) || 0,
        adoptionPrice: Number(item.adoptionPrice ?? item.price) || 0,
        isOwned: item.isOwned === true,
        isPurchased: item.isPurchased === true,
        license: item.license || "CC-BY",
        targetAudience: item.targetAudience || ""
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
        throw new Error(marketplaceT("visitEditor.loadOriginalError"));
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

        if (titleEl) titleEl.textContent = marketplaceT("visitEditor.editHeading");
        if (kickerEl) kickerEl.textContent = marketplaceT("visitEditor.kicker");
        if (toolbarTitleEl) toolbarTitleEl.textContent = marketplaceT("visitEditor.savedSequence");

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
            if(typeof createNewBlock === 'function') createNewBlock(marketplaceT("visitEditor.firstStop"));
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

        setActiveBlock(blocksContainer.querySelector('.visit-block'));

    } catch(err) {
        console.error("ERRORE CRITICO in caricaVisitaEsistente:", err);
        if(typeof createNewBlock === 'function') createNewBlock(marketplaceT("visitEditor.firstStop"));
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

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = state.blocks;

            Array.from(tempDiv.children).forEach(block => {
                blocksContainer.appendChild(block);
                block.dataset.sectionType = block.dataset.sectionType || 'artwork';
                block.dataset.blockUid = block.dataset.blockUid || generateBlockUid();
                normalizeBlockAddButton(block);
                bindBlockDelete(block);
                block.querySelector('.block-title-input').addEventListener('input', renderChapterTabs);

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
            const restoredActiveBlock = state.activeBlockUid
                ? blocksContainer.querySelector(`.visit-block[data-block-uid="${state.activeBlockUid}"]`)
                : null;
            setActiveBlock(restoredActiveBlock || blocksContainer.querySelector('.visit-block'));
            aggiornaContatoriBlocchi();
        } else {
            createNewBlock(marketplaceT("visitEditor.firstStop"));
        }
    }

    let catalogHydrated = false;
    try {
        await loadMuseumItemCatalog(true);
        catalogHydrated = true;
    } catch (error) {
        console.error("Errore nel caricamento del catalogo prezzi:", error);
    }

    hydrateVisitItemChoices();
    if (shouldRestoreState && catalogHydrated) {
        sessionStorage.removeItem('temp_visit_state');
    }
});

window.addEventListener('marketplace:language-changed', () => {
    setVisitVisibility(getVisitVisibility());
    setGroupVisit(getGroupVisit());

    if (visitId) {
        const titleEl = document.querySelector('.visit-builder-title');
        const kickerEl = document.querySelector('.visit-builder-kicker');
        const toolbarTitleEl = document.querySelector('.section-title-new');
        if (titleEl) titleEl.textContent = marketplaceT('visitEditor.editHeading');
        if (kickerEl) kickerEl.textContent = marketplaceT('visitEditor.kicker');
        if (toolbarTitleEl) toolbarTitleEl.textContent = marketplaceT('visitEditor.savedSequence');
    }

    document.querySelectorAll('.visit-block').forEach((block) => {
        normalizeBlockAddButton(block);
        const deleteButton = block.querySelector('.delete-block-btn');
        const deleteLabel = marketplaceT('visitEditor.removeSectionAria');
        deleteButton.title = deleteLabel;
        deleteButton.setAttribute('aria-label', deleteLabel);
        block.querySelectorAll('.question-editor').forEach((editor) => {
            const typeSelect = editor.querySelector('.question-answer-type');
            typeSelect.setAttribute('aria-label', marketplaceT('visitEditor.answerTypeAria'));
            typeSelect.querySelector('option[value="open"]').textContent = marketplaceT('visitEditor.openAnswer');
            typeSelect.querySelector('option[value="multiple-choice"]').textContent = marketplaceT('visitEditor.multipleChoice');
            editor.querySelector('.delete-question-btn').setAttribute('aria-label', marketplaceT('visitEditor.removeQuestionAria'));
            const prompt = editor.querySelector('.question-prompt');
            prompt.placeholder = marketplaceT('visitEditor.questionPlaceholder');
            prompt.setAttribute('aria-label', marketplaceT('visitEditor.questionAria'));
            editor.querySelector('.add-question-option').textContent = marketplaceT('visitEditor.addOption');
            editor.querySelectorAll('.question-option-row').forEach((row) => {
                row.querySelector('.question-correct-option').setAttribute('aria-label', marketplaceT('visitEditor.setCorrectAria'));
                row.querySelector('.question-correct-label span').textContent = marketplaceT('visitEditor.correct');
                row.querySelector('.question-option-input').placeholder = marketplaceT('visitEditor.answerOption');
                row.querySelector('.delete-option-btn').setAttribute('aria-label', marketplaceT('visitEditor.removeOptionAria'));
            });
        });
        const list = block.querySelector('.block-list');
        if (list) {
            list.querySelectorAll('.draggable-item').forEach((item) => {
                const openControl = item.querySelector('.item-open-editor')
                    || item.querySelector('.item-accordion-header');
                openControl.setAttribute('aria-label', marketplaceT('visitEditor.editTextsAria'));
                [
                    ['.edit-item-btn', 'visitEditor.editTexts'],
                    ['.replace-item-btn', 'visitEditor.changeContent'],
                    ['.drag-handle', 'visitEditor.reorder'],
                    ['.delete-btn', 'visitEditor.removeContent']
                ].forEach(([selector, key]) => {
                    const button = item.querySelector(selector);
                    if (!button) return;
                    const label = marketplaceT(key);
                    button.title = label;
                    button.setAttribute('aria-label', label);
                });
                const choiceLabel = item.querySelector('.item-choice-label');
                if (choiceLabel) choiceLabel.textContent = marketplaceT('visitEditor.itemLabel');
                populateItemChoiceSelect(item);
                if (itemCatalogReady) updateItemSpecificRow(item);
            });
            refreshRouteConnectors(list);
        }
    });
    if (!itemModal.classList.contains('hidden')) {
        apriModaleOpere(pendingItemReplacement);
    }
    aggiornaContatoriBlocchi();
});

// --- SALVATAGGIO FINALE NEL DATABASE ---

document.getElementById('save-visit-btn').addEventListener('click', async () => {
    const title = document.getElementById('v-title').value;
    const desc = document.getElementById('v-desc').value;

    if (!title.trim()) {
        alert(marketplaceT("visitEditor.titleRequired"));
        return;
    }

    const hasContentStops = Boolean(document.querySelector('.draggable-item'));
    if (hasContentStops && !itemCatalogReady) {
        alert(marketplaceT('visitEditor.catalogRequiredBeforeSave'));
        return;
    }

    if (hasContentStops && calculatePendingVisitCost() > currentWalletBalance) {
        alert(marketplaceT('visitEditor.insufficientBalance'));
        return;
    }

    const structurData = [];
    let sequenceObjects = [];
    let globalOrder = 1;
    let validationError = "";

    // Raccogliamo i dati e costruiamo gli oggetti
    document.querySelectorAll('.visit-block').forEach(block => {
        if (validationError) return;

        const blockTitle = block.querySelector('.block-title-input').value.trim()
            || marketplaceT('visitEditor.sectionFallback');
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
                    validationError = marketplaceT('visitEditor.writeEveryQuestion', {
                        section: blockTitle
                    });
                } else if (answerType === 'multiple-choice' && options.length < 2) {
                    validationError = marketplaceT('visitEditor.needTwoOptions', {
                        section: blockTitle
                    });
                } else if (answerType === 'multiple-choice' && correctIndex < 0) {
                    validationError = marketplaceT('visitEditor.chooseCorrect', {
                        section: blockTitle
                    });
                }

                return {
                    prompt,
                    answerType,
                    options: answerType === 'multiple-choice' ? options : [],
                    ...(answerType === 'multiple-choice' && { correctIndex })
                };
            });

            if (questions.length === 0) {
                validationError = marketplaceT('visitEditor.needQuestion', {
                    section: blockTitle
                });
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
        const itemWithoutSelection = Array.from(itemsNodes).find((node) => !node.dataset.itemId);
        if (itemWithoutSelection) {
            validationError = marketplaceT('visitEditor.chooseItemBeforeSave', {
                title: itemWithoutSelection.dataset.title || marketplaceT('common.content')
            });
            return;
        }

        const unavailableItem = Array.from(itemsNodes).find(
            (node) => !itemCatalog[node.dataset.itemId]
        );
        if (unavailableItem) {
            validationError = marketplaceT('visitEditor.itemUnavailableBeforeSave', {
                title: unavailableItem.dataset.title || marketplaceT('common.content')
            });
            return;
        }

        const itemForDifferentContent = Array.from(itemsNodes).find((node) => {
            const selectedItem = itemCatalog[node.dataset.itemId];
            return selectedItem.contentId !== node.dataset.contentId;
        });
        if (itemForDifferentContent) {
            validationError = marketplaceT('visitEditor.itemContentMismatch', {
                title: itemForDifferentContent.dataset.title || marketplaceT('common.content')
            });
            return;
        }

        const itemsIds = Array.from(itemsNodes).map(node => node.dataset.itemId);

        structurData.push({
            type: 'artwork',
            blockName: blockTitle,
            items: itemsIds,
            questions: []
        });

        Array.from(itemsNodes).forEach((node, index, nodes) => {
            const isLastInBlock = index === nodes.length - 1;
            sequenceObjects.push({
                itemId: node.dataset.itemId,
                order: globalOrder++,
                // L'ultima tappa di un capitolo non ha una "prossima opera": non
                // salviamo indicazioni residue che non corrisponderebbero più a nulla.
                nextDirections: isLastInBlock ? "" : (node.dataset.nextDirections || "").trim(),
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
        alert(marketplaceT("visitEditor.needContent"));
        return;
    }

    if (questionCount > 0 && !getGroupVisit()) {
        alert(marketplaceT("visitEditor.questionsRequireGroup"));
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
                ? marketplaceT("visitEditor.savedCharged", {
                    amount: formatCurrencyAmount(chargedAmount)
                })
                : marketplaceT("visitEditor.saved");
            alert(successMessage);

            // Reindirizziamo al Marketplace
            window.location.href = `visits_list.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
        } else {
            const errorData = await res.json().catch(() => ({}));
            console.error("Errore Backend:", errorData);
            alert(marketplaceT(
                errorData.error === "Insufficient balance"
                    ? "visitEditor.insufficientBalance"
                    : "visitEditor.saveError"
            ));
        }
    } catch(err) {
        console.error("Errore di rete:", err);
        alert(marketplaceT("errors.connection"));
    }
});
