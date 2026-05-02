const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token");

if (!token) {
    alert("You must be logged in to access this page.");
    window.location.href = "../pages/login.html";
}

const urlParams = new URLSearchParams(window.location.search);
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName');
const visitId = urlParams.get('visitId'); 

// Diamo "memoria" al pulsante Back to Museum page
const backToMuseumBtn = document.getElementById('back-to-museum-btn');
if (backToMuseumBtn) {
    // Aggiorniamo l'href dinamicamente inserendo l'ID che abbiamo appena letto
    backToMuseumBtn.href = `museums_list.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
}

const displayMuseumEl = document.getElementById('display-museum-name');
if (displayMuseumEl) displayMuseumEl.innerText = museumName || "No museums";

// --- LOGICA MODALE ANNULLA / ESCI ---
const cancelModal = document.getElementById('cancel-confirm-modal');
document.getElementById('cancel-btn').addEventListener('click', () => {
    cancelModal.classList.remove('hidden');
});
document.getElementById('confirm-exit-btn').addEventListener('click', () => {
    window.location.href = `../pages/museums_list.html`; 
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
let activeBlockList = null; 

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
            <input type="text" class="block-title-input" value="${defaultTitle}">
            <span class="block-count">0 artworks</span>
            <button class="delete-block-btn" title="Remove section">✖</button>
        </div>
        <ul class="block-list"></ul>
        <div style="display: flex; justify-content: center; margin-top: auto; padding-top: 15px;">
            <button class="add-btn add-item-to-block" title="Add an artwork to this section">+</button>
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
}

// --- LOGICA RECUPERO OPERE ED INCROCIO CON I CONTENTS ---
async function apriModaleOpere() {
    itemModal.classList.remove('hidden');
    itemsContainer.innerHTML = '<p style="text-align:center;">Loading from server...</p>';

    try {
        // Scarica i Contents (per avere Nomi Veri, Immagini e Autori)
        const contentsRes = await fetch(`${myApi}/museums/${museumId}/contents`, { headers: { 'Authorization': `Bearer ${token}` } });
        const contentsData = await contentsRes.json();
        const museumContents = contentsData.contents || [];
        
        const validContentIds = new Set();
        museumContents.forEach(c => {
            if (c.universalId) validContentIds.add(c.universalId);
            validContentIds.add(c._id.toString());
        });

        // Scarica gli Items (per avere i Prezzi e verificare l'esistenza dell'opera)
        const itemsRes = await fetch(`${myApi}/items`, { headers: { 'Authorization': `Bearer ${token}` } });
        const itemsData = await itemsRes.json();
        const museumItems = (itemsData.items || []).filter(item => validContentIds.has(item.contentId));

        itemsContainer.innerHTML = '';
        if (museumItems.length > 0) {
            museumItems.forEach(item => {
                
                // INCROCIO DATI: Cerchiamo il Content corrispondente a questo Item
                const relatedContent = museumContents.find(c => c.universalId === item.contentId || c._id.toString() === item.contentId);
                
                // Estraiamo i dati reali dal database
                const contentName = relatedContent ? relatedContent.name : `Opera (${item.contentId})`;
                const contentAuthor = relatedContent ? relatedContent.author : "Autore Ignoto";
                const imageUrl = relatedContent ? relatedContent.imageUrl : null;
                
                // Usiamo il titolo personalizzato se esiste, altrimenti il nome vero dell'opera dal Content
                const itemTitle = (item.descriptions && item.descriptions.length > 0 && item.descriptions[0].title) 
                                  ? item.descriptions[0].title 
                                  : contentName;

                const itemDiv = document.createElement('div');
                itemDiv.style.padding = '12px'; itemDiv.style.borderBottom = '1px solid #e2e8f0'; itemDiv.style.cursor = 'pointer'; itemDiv.style.display = 'flex'; itemDiv.style.justifyContent = 'space-between';
                itemDiv.innerHTML = `<strong>${itemTitle}</strong> <span style="color: var(--chil-grey);">${item.price > 0 ? item.price+'€' : 'Free'}</span>`;
                
                itemDiv.onclick = () => {
                    // Passiamo anche imageUrl e contentAuthor alla carta!
                    creaEdAggiungiItem(itemTitle, item._id, activeBlockList, imageUrl, contentAuthor);
                    itemModal.classList.add('hidden');
                };
                itemsContainer.appendChild(itemDiv);
            });
        } else {
            itemsContainer.innerHTML = '<p style="text-align:center; color: var(--chil-grey);">No artworks found.</p>';
        }
    } catch (err) {
        itemsContainer.innerHTML = '<p style="text-align:center; color: var(--error-red);">Connection error.</p>';
    }
}

document.getElementById('close-item-modal').addEventListener('click', () => itemModal.classList.add('hidden'));

// --- DRAG & DROP INCROCIATO & CREAZIONE CARTA ---
let draggedItem = null;
let placeholder = document.createElement('li');
placeholder.className = 'placeholder';

// AGGIORNATA: Ora riceve imageUrl e author per stampare la carta vera
function creaEdAggiungiItem(titoloOpera, itemId, targetList, imageUrl = null, author = "Autore Ignoto") {
    const li = document.createElement('li');
    li.classList.add('draggable-item');
    li.setAttribute('draggable', 'true');
    li.dataset.itemId = itemId; 

    // Risolviamo il percorso dell'immagine
    let imgTag = "IMG";
    if (imageUrl) {
        const finalImgUrl = imageUrl.startsWith('http') ? imageUrl : `http://localhost:8000${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        imgTag = `<img src="${finalImgUrl}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'">`;
    }

    li.innerHTML = `
        <div class="card-header">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="drag-handle" title="Drag">☰</span>
                <strong style="color: var(--charcoal); font-size: 1.05rem;">${titoloOpera}</strong>
            </div>
            <button class="delete-btn" title="Remove">✖</button>
        </div>
        <div class="card-details">
            <div class="card-image-placeholder" style="overflow:hidden; border: 1px solid #e2e8f0;">
                ${imgTag}
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                <p style="margin: 0; font-size: 0.95rem; color: var(--blue);"><strong>${author}</strong></p>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;">Click to edit this artwork's texts.</p>
            </div>
        </div>
    `;

    li.addEventListener('click', function(e) {
        if(e.target.closest('.delete-btn') || e.target.closest('.drag-handle')) {
            return;
        }
        salvaStatoTemporaneo();
        
        // Nuova logica: passiamo anche autore e immagine
        const params = new URLSearchParams({
            itemId: itemId,
            museumId: museumId,
            museumName: museumName,
            title: titoloOpera,
            author: author || "Autore Ignoto",
            image: imageUrl || ''
        });
        window.location.href = `create_items.html?${params.toString()}`;
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
        blocks: blocksHtml,
        blockCounter: blockCounter
    };
    sessionStorage.setItem('temp_visit_state', JSON.stringify(visitState));
}

// --- FUNZIONE PER RICOSTRUIRE IL TAVOLO ARCHIDEKT DA UNA VISITA ESISTENTE ---
// --- FUNZIONE PER RICOSTRUIRE IL TAVOLO ARCHIDEKT (CON DEBUG) ---
async function caricaVisitaEsistente(vId) {
    try {
        console.log("🔥 INIZIO CARICAMENTO VISITA ID:", vId);
        document.querySelector('.editor-title').textContent = "Edit Tour Mode"; 
        
        // 1. Scarichiamo i dati
        const res = await fetch(`${myApi}/visits/${vId}`); // Se hai sbloccato la rotta pubblica
        if (!res.ok) throw new Error("Errore nel recupero della visita dal database");
        const data = await res.json();
        const visit = data.visit || data;

        console.log("📦 DATI GREZZI DAL DATABASE:", visit);

        // 2. Separiamo la descrizione dai blocchi in modo più robusto
        let cleanDesc = visit.description || "";
        let structurData = null;
        const splitTag = "[Struttura Blocchi Salvata: "; // <-- Tolti i \n\n che causavano l'errore!
        
        if (cleanDesc.includes(splitTag)) {
            console.log("✅ Trovata la stringa segreta!");
            const parts = cleanDesc.split(splitTag);
            
            // La descrizione è la parte prima del tag (pulita da eventuali a capo rimasti)
            cleanDesc = parts[0].trim(); 
            
            const jsonString = parts[1].trim().slice(0, -1); // Toglie la ']' finale
            console.log("🧩 JSON estratto:", jsonString);
            
            try { 
                structurData = JSON.parse(jsonString); 
                console.log("🛠️ Struttura interpretata correttamente:", structurData);
            } catch(e) { 
                console.error("❌ Il JSON si è rotto (forse il database lo ha tagliato?):", e); 
            }
        } else {
            console.warn("⚠️ Nessuna struttura trovata! Ecco cosa c'è salvato in description:", cleanDesc);
        }

        // 3. Compiliamo titolo e descrizione
        if(document.getElementById('v-title')) document.getElementById('v-title').value = visit.title;
        if(document.getElementById('v-desc')) document.getElementById('v-desc').value = cleanDesc;

        if (!structurData || structurData.length === 0) {
            console.log("Costruisco tavolo vuoto di default.");
            if(typeof createNewBlock === 'function') createNewBlock("Mainboard");
            return;
        }

        // 4. Scarichiamo le opere per stampare le carte vere
        console.log("📥 Scarico le opere del museo per abbinare i dati...");
        const token = localStorage.getItem("token");
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const contentsRes = await fetch(`${myApi}/museums/${museumId}/contents`, { headers });
        const contentsData = await contentsRes.json();
        const museumContents = contentsData.contents || [];

        const itemsRes = await fetch(`${myApi}/items`, { headers });
        const itemsData = await itemsRes.json();
        const allItems = itemsData.items || [];

        const itemMap = {};
        allItems.forEach(item => {
            const relatedContent = museumContents.find(c => c.universalId === item.contentId || c._id.toString() === item.contentId);
            itemMap[item._id] = {
                title: relatedContent ? relatedContent.name : "Opera",
                author: relatedContent ? relatedContent.author : "Autore Ignoto",
                imageUrl: relatedContent ? relatedContent.imageUrl : null
            };
        });

        // 5. Ricreiamo i blocchi
        console.log("🔨 Inizio a costruire le colonne e inserire le carte...");
        structurData.forEach(blockData => {
            createNewBlock(blockData.blockName); 
            
            const blocksNodes = document.querySelectorAll('.visit-block');
            const targetBlock = blocksNodes[blocksNodes.length - 1];
            const targetList = targetBlock.querySelector('.block-list');

            blockData.items.forEach(itemId => {
                const info = itemMap[itemId];
                if (info) {
                    creaEdAggiungiItem(info.title, itemId, targetList, info.imageUrl, info.author);
                } else {
                    console.warn(`Opera con ID ${itemId} non trovata nel database!`);
                }
            });
        });
        
        console.log("🎉 CARICAMENTO FINITO CON SUCCESSO!");

    } catch(err) {
        console.error("❌ ERRORE CRITICO in caricaVisitaEsistente:", err);
        if(typeof createNewBlock === 'function') createNewBlock("Mainboard"); 
    }
}

window.addEventListener('DOMContentLoaded', async () => {

    if (visitId && !sessionStorage.getItem('temp_visit_state')) {
        await caricaVisitaEsistente(visitId);
    } else {
        const savedState = sessionStorage.getItem('temp_visit_state');
        if (savedState) {
            const state = JSON.parse(savedState);
            if(document.getElementById('v-title')) document.getElementById('v-title').value = state.title;
            if(document.getElementById('v-desc')) document.getElementById('v-desc').value = state.desc;
            
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
                    const titoloOpera = li.querySelector('strong').innerText;

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
                        window.location.href = `create_items.html?itemId=${itemId}&museumId=${museumId}&museumName=${encodeURIComponent(museumName)}&title=${encodeURIComponent(titoloOpera)}`;
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
        description: desc + "\n\n[Struttura Blocchi Salvata: " + JSON.stringify(structurData) + "]",
        museumId: museumId,
        sequence: sequenceObjects,
        isPublic: false,
        type: "standard", 
        length: "normal"  
    };
    
    try {
        // Se c'è un visitId sovrascriviamo (PUT), altrimenti creiamo nuovo (POST)
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
            alert("Visita salvata con successo nel database!");
            sessionStorage.removeItem('temp_visit_state');
            
            // Reindirizziamo al Marketplace
            window.location.href = "museums_list.html"; 
        } else {
            const errorText = await res.text();
            console.error("Errore Backend:", errorText);
            alert("Impossibile salvare. Controlla la console per i dettagli.");
        }
    } catch(err) {
        console.error("Errore di rete:", err);
        alert("Errore di connessione al server.");
    }
});