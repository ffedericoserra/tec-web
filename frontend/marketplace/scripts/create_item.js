// --- CONFIGURAZIONE E AUTENTICAZIONE ---
const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token");

const loggedInUsername = localStorage.getItem("username") || "Tu"; 

if (!token) window.location.href = "login.html";

// 1. LEGGIAMO I DATI DALL'URL (Arrivano dal Content fisso)
const urlParams = new URLSearchParams(window.location.search);
let activeItemId = urlParams.get('itemId'); 
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName') || 'Sconosciuto';
const urlTitle = urlParams.get('title') || 'Titolo Sconosciuto';
const urlAuthor = urlParams.get('author') || 'Autore Ignoto';
const urlImage = urlParams.get('image');

const urlYear = urlParams.get('year') || 'N/D';
const urlPrice = urlParams.get('price') || 'N/D';
const urlContentId = urlParams.get('contentId'); 

// VARIABILI GLOBALI
let originalContentId = urlContentId || null;
let originalTargetAudience = null;

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

document.addEventListener('DOMContentLoaded', async () => {
    // Popoliamo la grafica fissa dell'opera
    document.getElementById('artwork-title-display').textContent = `${urlTitle} - ${urlAuthor}`;
    document.getElementById('museum-name-display').textContent = museumName;
    document.getElementById('item-anno').value = urlYear;
    document.getElementById('item-prezzo').value = urlPrice;

    const imgContainer = document.getElementById('image-preview');
    if (urlImage) {
        const finalImgUrl = urlImage.startsWith('http') ? urlImage : `${baseUrl}${urlImage.startsWith('/') ? '' : '/'}${urlImage}`;
        imgContainer.innerHTML = `<img src="${finalImgUrl}" style="width:100%; height:100%; object-fit:cover; border-radius: 0;">`;
    }

    // Logica Accordion (Freccette)
    audienceMap.forEach(aud => {
        const header = document.querySelector(`.audience-header[data-aud="${aud.id}"]`);
        const textarea = document.getElementById(`text-${aud.id}`);
        const arrow = document.getElementById(`arrow-${aud.id}`);
        
        if(header && textarea && arrow) {
            header.addEventListener('click', () => {
                textarea.classList.toggle('hidden');
                arrow.classList.toggle('open');
            });
        }
    });

    if (activeItemId) {
        await caricaTestiDaDB(activeItemId);
        document.getElementById('dropdown-selected-text').textContent = "Modificando il tuo Item selezionato";
    }

    // Carichiamo le varianti della community solo per QUESTO contentId
    if (originalContentId) {
        loadCommunityItems();
    } else {
        document.getElementById('existing-items-list').innerHTML = '<li style="color:gray;">Salva l\'item per vedere le versioni degli altri utenti.</li>';
    }

    document.getElementById('btn-cancel-exit').addEventListener('click', () => {
        window.location.href = `create_visits.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
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
            existingItemsList.innerHTML = '<li style="color:gray;">Nessuna variante creata per questa opera.</li>';
            return;
        }

        const uniqueItemsMap = new Map();
        communityItems.forEach(item => {
            const creatorName = item.creatorId?.username || (typeof item.creatorId === 'string' ? item.creatorId : 'Anonimo');
            
            let contentSignature = "";
            if (item.descriptions && Array.isArray(item.descriptions)) {
                const sortedDesc = [...item.descriptions].sort((a, b) => a.tone.localeCompare(b.tone));
                contentSignature = sortedDesc.map(d => `${d.tone}:${d.texts[0]?.text || ''}`).join("|");
            }
            
            const uniqueKey = `${creatorName}-${contentSignature}`;
            if (!uniqueItemsMap.has(uniqueKey)) uniqueItemsMap.set(uniqueKey, item);
        });
        
        const uniqueItems = Array.from(uniqueItemsMap.values());
        const authorCounts = {};

        uniqueItems.forEach(item => {
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

            li.innerHTML = `<span>Item di <strong>${displayCreatorName}</strong></span> <span style="font-size: 0.8rem; color: #710014; font-weight:bold;">${tagsText}</span>`;
            
            li.addEventListener('click', () => {
                caricaTestiDaDB(item._id);
                document.getElementById('dropdown-selected-text').textContent = `Visualizzando l'Item di: ${displayCreatorName}`;
                
                const btnDelete = document.getElementById('btn-delete-item');
                if (creatorName === loggedInUsername) {
                    activeItemId = item._id; 
                    btnDelete.classList.remove('hidden');
                } else {
                    activeItemId = null; 
                    btnDelete.classList.add('hidden'); 
                }
                
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
    document.getElementById('dropdown-selected-text').textContent = "Crea il tuo item (Nuovo)";
    document.getElementById('btn-delete-item').classList.add('hidden'); 
    dropdownMenu.classList.add('hidden');
});

function clearUI() {
    audienceMap.forEach(aud => {
        const textarea = document.getElementById(`text-${aud.id}`);
        const arrow = document.getElementById(`arrow-${aud.id}`);
        if(textarea) {
            textarea.value = '';
            textarea.classList.add('hidden'); 
        }
        if(arrow) arrow.classList.remove('open'); 
    });
    document.getElementById('item-creatore').value = loggedInUsername;
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
        if (currentItem.content && currentItem.content._id) originalContentId = currentItem.content._id;
        if (currentItem.targetAudience) originalTargetAudience = currentItem.targetAudience;
        
        if (currentItem.price !== undefined) document.getElementById('item-prezzo').value = currentItem.price;
        if (currentItem.year) document.getElementById('item-anno').value = currentItem.year;

        clearUI();
        
        let creatorName = "Utente Ignoto";
        if (currentItem.creatorId && currentItem.creatorId.username) creatorName = currentItem.creatorId.username;
        else if (typeof currentItem.creatorId === 'string') creatorName = `Utente ${currentItem.creatorId.substring(0, 5)}`;
        
        document.getElementById('item-creatore').value = creatorName;

        if (currentItem.descriptions && currentItem.descriptions.length > 0) {
            currentItem.descriptions.forEach(descGroup => {
                const uiMap = audienceMap.find(a => a.tone === descGroup.tone);
                if(uiMap && descGroup.texts && descGroup.texts.length > 0) {
                    const textarea = document.getElementById(`text-${uiMap.id}`);
                    const arrow = document.getElementById(`arrow-${uiMap.id}`);
                    
                    if(textarea) {
                        textarea.value = descGroup.texts[0].text || "";
                        textarea.classList.remove('hidden'); 
                        if(arrow) arrow.classList.add('open'); 
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
        const textarea = document.getElementById(`text-${aud.id}`);
        if (textarea && textarea.value.trim() !== "") {
            finalDescriptions.push({
                tone: aud.tone, 
                texts: [{ text: textarea.value.trim(), lengthCategory: "15s", language: "it" }]
            });
        }
    });

    if (finalDescriptions.length === 0) {
        showToast("Scrivi almeno una descrizione per salvare l'Item!", "error");
        return;
    }

    // ECCO IL PAYLOAD PULITO: Invia solo le informazioni dell'Item!
    const payload = {
        isPublic: true, 
        contentId: originalContentId, // Il gancio che collega questo Item all'opera fissa
        targetAudience: originalTargetAudience || 'general',
        descriptions: finalDescriptions
    };

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
                window.location.href = `create_visits.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
            }, 1200);
        } else {
            showToast("Errore di validazione dal server.", "error");
        }
    } catch (error) {
        showToast("Errore di rete o connessione.", "error");
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