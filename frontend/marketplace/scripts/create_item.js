// --- CONFIGURAZIONE E AUTENTICAZIONE ---
const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token") || localStorage.getItem("artaround_token");
const CONTENT_PLACEHOLDER = "/uploads/placeholders/template-no-image.jpg";

const loggedInUsername = localStorage.getItem("username") || "Tu"; 

if (!token) window.location.href = "login.html";

// 1. LEGGIAMO I DATI DALL'URL (Arrivano dal Content fisso)
const urlParams = new URLSearchParams(window.location.search);
let activeItemId = urlParams.get('itemId'); 
let viewedItemId = activeItemId;
const sourcePage = urlParams.get('source') || 'my-items';
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName') || 'Sconosciuto';
const visitId = urlParams.get('visitId');
const urlTitle = urlParams.get('title') || 'Titolo Sconosciuto';
const urlAuthor = urlParams.get('author') || 'Autore Ignoto';
const urlImage = urlParams.get('image');

const urlContentId = urlParams.get('contentId');

// VARIABILI GLOBALI
let originalContentId = urlContentId || null;
let museumContentsCache = [];

function resolveAssetUrl(path) {
    if (!path) return "";
    return path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

function getVisitBuilderUrl() {
    if (sourcePage === 'my-items') {
        const params = new URLSearchParams();
        if (originalContentId) params.set('contentId', originalContentId);
        return `my_items.html${params.toString() ? `?${params.toString()}` : ''}`;
    }

    const params = new URLSearchParams({
        museumId: museumId,
        museumName: museumName,
        resume: '1'
    });

    if (visitId) params.set('visitId', visitId);
    return `create_visits.html?${params.toString()}`;
}

// --- SISTEMA DI TOAST NOTIFICATIONS ---
function showToast(message, type = "success") {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); 
    }, 3500);
}

// --- MAPPATURA UI <-> DATABASE ---
const audienceMap = [
    { id: 'children', tone: 'easy', label: 'bimbi' },
    { id: 'standard', tone: 'medium', label: 'standard' },
    { id: 'expert', tone: 'complex', label: 'esperti' }
];

const durationMap = ['15s', '30s', '60s'];
// Tab aperta di default in ogni sezione tono: la durata "media" della terna.
const DEFAULT_DURATION = durationMap[1];

// --- GUIDA ALLA SCRITTURA: placeholder su misura per tono e lunghezza ---
// Ognuna delle 9 caselle (3 toni x 3 durate) riceve un suggerimento diverso —
// lessico atteso, ingombro indicativo in parole e il titolo dell'opera aperta —
// al posto dello stesso placeholder generico ripetuto ovunque.
const TONE_WRITING_GUIDE = {
    children: { lexicon: 'lessico semplice e frasi brevi', voice: 'un tono curioso e giocoso, come lo spiegheresti a un bambino' },
    standard: { lexicon: 'lessico comune e scorrevole', voice: 'un tono chiaro e accessibile, adatto al grande pubblico' },
    expert: { lexicon: 'lessico specialistico', voice: 'approfondimenti tecnici, storico-critici o materici per un pubblico esperto' }
};

// Le durate sono lette da un vocalizzatore (TTS), non lette dall'occhio: il
// conteggio parole è calibrato su un ritmo di lettura parlata (~150 parole/min).
const DURATION_WRITING_GUIDE = {
    '15s': { words: '30-40 parole', shape: 'un breve paragrafo essenziale' },
    '30s': { words: '65-80 parole', shape: 'un paragrafo più corposo, con un dettaglio in più' },
    '60s': { words: '130-160 parole', shape: 'un racconto esteso su più frasi, pensato per essere ascoltato per intero' }
};

function buildTextPlaceholder(audienceId, duration) {
    const tone = TONE_WRITING_GUIDE[audienceId];
    const length = DURATION_WRITING_GUIDE[duration];
    if (!tone || !length) return '';
    return `Descrivi "${urlTitle}" con ${tone.lexicon}: ${tone.voice}. Punta a ${length.words} (${length.shape}).`;
}

function applyTailoredPlaceholders() {
    audienceMap.forEach(aud => {
        durationMap.forEach(duration => {
            const textarea = getAudienceTextarea(aud.id, duration);
            if (textarea) textarea.placeholder = buildTextPlaceholder(aud.id, duration);
        });
    });
}

function getAudienceTextarea(audienceId, duration) {
    return document.getElementById(`text-${audienceId}-${duration}`);
}

function setActiveDuration(audienceId, duration) {
    const panel = document.getElementById(`audience-panel-${audienceId}`);
    if (!panel || !durationMap.includes(duration)) return;

    panel.querySelectorAll('.duration-tab').forEach(tab => {
        const isActive = tab.dataset.duration === duration;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
    });

    panel.querySelectorAll('.audience-textarea').forEach(textarea => {
        textarea.classList.toggle('hidden', textarea.dataset.duration !== duration);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Popoliamo la grafica fissa dell'opera
    document.getElementById('artwork-title-display').textContent = `${urlTitle} - ${urlAuthor}`;
    document.getElementById('museum-name-display').textContent = museumName;
    applyTailoredPlaceholders();
    resetCommercialFields();
    await loadAssociatedContentOptions();

    const imgContainer = document.getElementById('image-preview');
    const imagePath = urlImage || CONTENT_PLACEHOLDER;
    const img = document.createElement('img');
    img.src = resolveAssetUrl(imagePath);
    img.alt = urlTitle;
    img.classList.add('image-preview-img');
    imgContainer.innerHTML = '';
    imgContainer.appendChild(img);

    // Logica Accordion (Freccette)
    audienceMap.forEach(aud => {
        const header = document.querySelector(`.audience-header[data-aud="${aud.id}"]`);
        const panel = document.getElementById(`audience-panel-${aud.id}`);
        const arrow = document.getElementById(`arrow-${aud.id}`);
        
        if(header && panel && arrow) {
            header.addEventListener('click', () => {
                const isOpen = !panel.classList.toggle('hidden');
                arrow.classList.toggle('open', isOpen);
                header.setAttribute('aria-expanded', String(isOpen));
            });

            panel.querySelectorAll('.duration-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    setActiveDuration(aud.id, tab.dataset.duration);
                    getAudienceTextarea(aud.id, tab.dataset.duration)?.focus();
                });

                tab.addEventListener('keydown', event => {
                    const tabs = Array.from(panel.querySelectorAll('.duration-tab'));
                    const currentIndex = tabs.indexOf(tab);
                    let nextIndex = currentIndex;

                    if (event.key === 'ArrowRight') {
                        nextIndex = (currentIndex + 1) % tabs.length;
                    } else if (event.key === 'ArrowLeft') {
                        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    } else if (event.key === 'Home') {
                        nextIndex = 0;
                    } else if (event.key === 'End') {
                        nextIndex = tabs.length - 1;
                    } else {
                        return;
                    }

                    event.preventDefault();
                    const nextTab = tabs[nextIndex];
                    setActiveDuration(aud.id, nextTab.dataset.duration);
                    nextTab.focus();
                });
            });

            const activeTab = panel.querySelector('.duration-tab.is-active');
            setActiveDuration(aud.id, activeTab?.dataset.duration || DEFAULT_DURATION);
        }
    });

    if (activeItemId) {
        await caricaTestiDaDB(activeItemId);
    }

    // Carichiamo le varianti della community solo per QUESTO contentId
    if (originalContentId) {
        loadCommunityItems();
    } else {
        document.getElementById('existing-items-list').innerHTML = '<li class="muted-list-message">Salva l\'item per vedere le versioni degli altri utenti.</li>';
    }

    document.getElementById('btn-cancel-exit').addEventListener('click', () => {
        window.location.href = getVisitBuilderUrl();
    });
});

// --- MENU A TENDINA E RICERCA COMMUNITY ---
const dropdownTrigger = document.getElementById('dropdown-trigger');
const dropdownMenu = document.getElementById('dropdown-menu');
const existingItemsList = document.getElementById('existing-items-list');

if (dropdownTrigger) {
    dropdownTrigger.addEventListener('click', () => dropdownMenu.classList.toggle('hidden'));
}

async function loadCommunityItems() {
    if (!originalContentId) return; 

    try {
        const res = await fetch(`${myApi}/items?contentId=${originalContentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return; 
        
        const responseData = await res.json();
        let communityItems = responseData.data || responseData.items || responseData;

        existingItemsList.innerHTML = '';

        if (!Array.isArray(communityItems) || communityItems.length === 0) {
            existingItemsList.innerHTML = '<li class="muted-list-message">Nessuna variante creata per questa opera.</li>';
            return;
        }

        const authorCounts = {};

        communityItems.forEach(item => {
            const li = document.createElement('li');
            
            let creatorName = 'Utente Anonimo';
            if (item.creatorId && item.creatorId.username) creatorName = item.creatorId.username;
            else if (typeof item.creatorId === 'string') creatorName = `Utente ${item.creatorId.substring(0, 5)}...`;

            if (!authorCounts[creatorName]) authorCounts[creatorName] = 0;
            authorCounts[creatorName]++;
            let displayCreatorName = authorCounts[creatorName] > 1 ? `${creatorName} (Variante ${authorCounts[creatorName]})` : creatorName;

            let tags = [];
            if (item.descriptions && Array.isArray(item.descriptions)) {
                item.descriptions.forEach(desc => {
                    const mappedAudience = audienceMap.find(a => a.tone === desc.tone);
                    if (mappedAudience) tags.push(mappedAudience.label);
                });
            }
            const tagsText = tags.length > 0 ? tags.join(', ') : 'nessun testo';
            const priceText = item.isOwned
                ? 'tuo'
                : item.isPurchased
                    ? 'acquisito'
                    : `${Number(item.price) || 0} crediti`;
            const itemDetails = `${tagsText} · ${item.license || 'CC-BY'} · ${priceText}`;

            const authorLine = document.createElement('span');
            const authorName = document.createElement('strong');
            authorName.textContent = displayCreatorName;
            authorLine.append(document.createTextNode('Item di '), authorName);

            const detailsLine = document.createElement('span');
            detailsLine.classList.add('community-item-tags');
            detailsLine.textContent = itemDetails;
            li.append(authorLine, detailsLine);
            
            li.addEventListener('click', () => {
                caricaTestiDaDB(item._id);
                document.getElementById('dropdown-selected-text').textContent = `Visualizzando l'Item di: ${displayCreatorName}`;
                dropdownMenu.classList.add('hidden');
            });
            existingItemsList.appendChild(li);
        });
    } catch (e) {
        console.error("Errore fetch community items:", e);
    }
}

document.getElementById('btn-create-new').addEventListener('click', () => {
    clearUI();
    activeItemId = null;
    viewedItemId = null;
    document.getElementById('dropdown-selected-text').textContent = "Crea il tuo item (Nuovo)";
    document.getElementById('btn-delete-item').classList.add('hidden');
    setSaveButtonState({ owned: true });
    dropdownMenu.classList.add('hidden');
});

// Il tasto Salva sta sempre affiancato ad Annulla, anche quando i testi
// visualizzati non sono i tuoi: i campi restano modificabili (v. sotto),
// quindi serve sempre un modo per salvare cio' che hai scritto. Se l'Item
// non e' tuo, "Salva" non sovrascrive quello altrui: crea una tua nuova
// copia (activeItemId resta null => POST, non PUT).
function setSaveButtonState({ owned }) {
    const saveBtn = document.getElementById('btn-save-exit');
    saveBtn.classList.remove('hidden');
    saveBtn.textContent = owned ? 'Salva Item' : 'Salva come nuovo Item';
}

function clearUI() {
    audienceMap.forEach(aud => {
        const header = document.querySelector(`.audience-header[data-aud="${aud.id}"]`);
        const panel = document.getElementById(`audience-panel-${aud.id}`);
        const arrow = document.getElementById(`arrow-${aud.id}`);

        durationMap.forEach(duration => {
            const textarea = getAudienceTextarea(aud.id, duration);
            if (textarea) textarea.value = '';
        });

        if(panel) panel.classList.add('hidden');
        if(header) header.setAttribute('aria-expanded', 'false');
        if(arrow) arrow.classList.remove('open');
        setActiveDuration(aud.id, DEFAULT_DURATION);
    });
    document.getElementById('item-creatore').value = loggedInUsername;
    document.getElementById('btn-purchase-item').classList.add('hidden');
    resetCommercialFields();
    document.querySelectorAll('.associated-content-checkbox').forEach((checkbox) => {
        checkbox.checked = false;
    });
}

function resetCommercialFields() {
    document.getElementById('item-prezzo').value = '0';
    document.getElementById('item-license').value = 'CC-BY';
    document.getElementById('item-is-public').checked = false;
    document.getElementById('item-target-audience').value = 'general';
}

async function loadAssociatedContentOptions(selectedIds = []) {
    const container = document.getElementById('associated-contents-list');
    if (!container) return;

    try {
        if (museumContentsCache.length === 0 && museumId) {
            const res = await fetch(`${myApi}/museums/${museumId}/contents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Content request failed');
            const data = await res.json();
            museumContentsCache = data.contents || [];
        }

        renderAssociatedContentOptions(selectedIds);
    } catch (error) {
        container.innerHTML = '';
        const message = document.createElement('p');
        message.classList.add('associated-empty-message');
        message.textContent = 'Contenuti non disponibili';
        container.appendChild(message);
    }
}

function renderAssociatedContentOptions(selectedIds = []) {
    const container = document.getElementById('associated-contents-list');
    const selected = new Set(selectedIds.map(String));
    const candidates = museumContentsCache.filter(
        (content) => content.universalId !== originalContentId
    );
    container.innerHTML = '';

    if (candidates.length === 0) {
        const message = document.createElement('p');
        message.classList.add('associated-empty-message');
        message.textContent = 'Nessun contenuto opzionale disponibile';
        container.appendChild(message);
        return;
    }

    candidates.forEach((content) => {
        const label = document.createElement('label');
        label.classList.add('associated-content-option');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('associated-content-checkbox');
        checkbox.value = content._id;
        checkbox.checked = selected.has(String(content._id));

        const name = document.createElement('span');
        name.classList.add('associated-content-name');
        name.textContent = content.name || 'Contenuto';

        const type = document.createElement('span');
        type.classList.add('associated-content-type');
        type.textContent = content.type || '';

        label.append(checkbox, name, type);
        container.appendChild(label);
    });
}

async function caricaTestiDaDB(idToLoad) {
    try {
        const res = await fetch(`${myApi}/items/${idToLoad}`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error("Errore nel recupero testi");
        const data = await res.json();
        const currentItem = data.item || data; 

        if (currentItem.contentId) originalContentId = currentItem.contentId;
        clearUI();
        viewedItemId = currentItem._id;
        activeItemId = currentItem.isOwned ? currentItem._id : null;

        document.getElementById('item-prezzo').value = String(currentItem.price ?? 0);
        document.getElementById('item-license').value = currentItem.license || 'CC-BY';
        document.getElementById('item-is-public').checked = Boolean(currentItem.isPublic);
        document.getElementById('item-target-audience').value = currentItem.targetAudience || 'general';
        await loadAssociatedContentOptions(
            (currentItem.associatedContents || []).map((content) => content._id || content)
        );

        document.getElementById('btn-delete-item').classList.toggle('hidden', !currentItem.isOwned);
        setSaveButtonState({ owned: currentItem.isOwned });
        document.getElementById('btn-purchase-item').classList.toggle(
            'hidden',
            currentItem.isOwned || currentItem.isPurchased || !currentItem.isPublic
        );
        document.getElementById('dropdown-selected-text').textContent = currentItem.isOwned
            ? 'Modificando il tuo Item selezionato'
            : currentItem.isPurchased
                ? 'Visualizzando un Item acquistato'
                : 'Visualizzando un Item disponibile';
        
        let creatorName = "Utente Ignoto";
        if (currentItem.creatorId && currentItem.creatorId.username) creatorName = currentItem.creatorId.username;
        else if (typeof currentItem.creatorId === 'string') creatorName = `Utente ${currentItem.creatorId.substring(0, 5)}`;
        
        document.getElementById('item-creatore').value = creatorName;

        if (currentItem.descriptions && currentItem.descriptions.length > 0) {
            currentItem.descriptions.forEach(descGroup => {
                const uiMap = audienceMap.find(a => a.tone === descGroup.tone);
                if(uiMap && descGroup.texts && descGroup.texts.length > 0) {
                    const header = document.querySelector(`.audience-header[data-aud="${uiMap.id}"]`);
                    const panel = document.getElementById(`audience-panel-${uiMap.id}`);
                    const arrow = document.getElementById(`arrow-${uiMap.id}`);
                    const loadedDurations = [];

                    // Prima passata: i testi con una lengthCategory riconosciuta
                    // (15s/30s/60s) vanno dritti nella loro casella.
                    const legacyTexts = [];
                    descGroup.texts.forEach((textEntry) => {
                        if (durationMap.includes(textEntry.lengthCategory)) {
                            const textarea = getAudienceTextarea(uiMap.id, textEntry.lengthCategory);
                            if (!textarea) return;
                            textarea.value = textEntry.text || "";
                            loadedDurations.push(textEntry.lengthCategory);
                        } else {
                            legacyTexts.push(textEntry);
                        }
                    });

                    // Seconda passata: testi salvati prima della migrazione a
                    // 15/30/60s (vecchie categorie 3s/45s) riempiono, in ordine,
                    // le caselle ancora libere — senza sovrascrivere un testo
                    // già assegnato nella prima passata e senza scartarne nessuno.
                    const freeDurations = durationMap.filter((d) => !loadedDurations.includes(d));
                    legacyTexts.forEach((textEntry, i) => {
                        const duration = freeDurations[i];
                        const textarea = duration ? getAudienceTextarea(uiMap.id, duration) : null;
                        if (!textarea) return;
                        textarea.value = textEntry.text || "";
                        loadedDurations.push(duration);
                    });

                    if (loadedDurations.length > 0) {
                        panel?.classList.remove('hidden');
                        header?.setAttribute('aria-expanded', 'true');
                        arrow?.classList.add('open');
                        setActiveDuration(
                            uiMap.id,
                            loadedDurations.includes(DEFAULT_DURATION) ? DEFAULT_DURATION : loadedDurations[0]
                        );
                    }
                }
            });
        }
    } catch (error) {
        console.error("Errore Database:", error);
    }
}

// --- SALVATAGGIO (Crea o Aggiorna) ---
document.getElementById('btn-save-exit').addEventListener('click', async () => {
    
    if (!activeItemId && !originalContentId) {
        showToast("Impossibile salvare: Manca il riferimento all'opera originale.", "error");
        return;
    }

    const finalDescriptions = [];
    audienceMap.forEach(aud => {
        const texts = durationMap.reduce((entries, duration) => {
            const textarea = getAudienceTextarea(aud.id, duration);
            const text = textarea?.value.trim();
            if (text) {
                entries.push({
                    text: text,
                    lengthCategory: duration,
                    // Il selettore lingua è stato rimosso dall'interfaccia:
                    // i testi sono redatti in italiano di default (v. AGENTS.md §3).
                    language: 'it'
                });
            }
            return entries;
        }, []);

        if (texts.length > 0) {
            finalDescriptions.push({
                tone: aud.tone, 
                texts: texts
            });
        }
    });

    if (finalDescriptions.length === 0) {
        showToast("Scrivi almeno una descrizione per salvare l'Item!", "error");
        return;
    }

    // ECCO IL PAYLOAD PULITO: Invia solo le informazioni dell'Item!
    const payload = {
        isPublic: document.getElementById('item-is-public').checked,
        contentId: originalContentId, // Il gancio che collega questo Item all'opera fissa
        targetAudience: document.getElementById('item-target-audience').value,
        descriptions: finalDescriptions,
        price: Number(document.getElementById('item-prezzo').value),
        license: document.getElementById('item-license').value,
        associatedContents: Array.from(
            document.querySelectorAll('.associated-content-checkbox:checked')
        ).map((checkbox) => checkbox.value)
    };

    if (!Number.isFinite(payload.price) || payload.price < 0) {
        showToast("Inserisci un prezzo valido, maggiore o uguale a zero.", "error");
        return;
    }

    try {
        const method = activeItemId ? 'PUT' : 'POST';
        const endpoint = activeItemId ? `${myApi}/items/${activeItemId}` : `${myApi}/items`;

        const res = await fetch(endpoint, {
            method: method,
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast("Item salvato con successo!", "success");
            setTimeout(() => {
                window.location.href = getVisitBuilderUrl();
            }, 1200);
        } else {
            const errorData = await res.json().catch(() => ({}));
            showToast(errorData.error || "Errore di validazione dal server.", "error");
        }
    } catch (error) {
        showToast("Errore di rete o connessione.", "error");
    }
});

document.getElementById('btn-purchase-item').addEventListener('click', async () => {
    if (!viewedItemId) return;

    try {
        const res = await fetch(`${myApi}/items/${viewedItemId}/purchase`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const responseData = await res.json().catch(() => ({}));
        if (!res.ok) {
            showToast(responseData.error || "Acquisto non riuscito.", "error");
            return;
        }

        document.getElementById('btn-purchase-item').classList.add('hidden');
        showToast(
            `Item acquisito. Saldo disponibile: ${responseData.walletBalance} crediti.`,
            "success"
        );
        await caricaTestiDaDB(viewedItemId);
        await loadCommunityItems();
    } catch (error) {
        showToast("Errore di connessione durante l'acquisto.", "error");
    }
});

// --- ELIMINAZIONE ITEM ---
document.getElementById('btn-delete-item').addEventListener('click', async () => {
    if (!activeItemId) return;

    if (!confirm("Sei sicuro di voler eliminare definitivamente questo item? L'azione è irreversibile.")) {
        return;
    }

    try {
        const res = await fetch(`${myApi}/items/${activeItemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            showToast("Item eliminato con successo!", "success");
            activeItemId = null; 
            document.getElementById('btn-delete-item').classList.add('hidden'); 
            clearUI(); 
            loadCommunityItems(); 
            document.getElementById('dropdown-selected-text').textContent = "Crea il tuo item (Nuovo)";
        } else {
            const errorData = await res.json();
            showToast(errorData.error || "Non sei autorizzato a eliminare questo item.", "error");
        }
    } catch (error) {
        showToast("Errore di connessione durante l'eliminazione.", "error");
    }
});
