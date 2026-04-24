const myApi = "http://localhost:8000/api";
const token = localStorage.getItem("token");

if (!token) {
    alert("You must be logged in to access this page.");
    window.location.href = "../pages/login.html";
}

const urlParams = new URLSearchParams(window.location.search);
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName');

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
    // Non serve più passargli il numero romano come titolo, usiamo un titolo di default
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
        // Aggiorniamo il contatore usando la funzione toRoman
        block.querySelector('.block-number').textContent = toRoman(index + 1);
        const itemCount = block.querySelectorAll('.draggable-item').length;
        block.querySelector('.block-count').textContent = `${itemCount} artworks`;
    });
    aggiornaStatoCarte(); 
}

// --- LOGICA RECUPERO OPERE ---
async function apriModaleOpere() {
    itemModal.classList.remove('hidden');
    itemsContainer.innerHTML = '<p style="text-align:center;">Loading from server...</p>';

    try {
        const contentsRes = await fetch(`${myApi}/museums/${museumId}/contents`, { headers: { 'Authorization': `Bearer ${token}` } });
        const contentsData = await contentsRes.json();
        const validContentIds = new Set();
        (contentsData.contents || []).forEach(c => {
            if (c.universalId) validContentIds.add(c.universalId);
            validContentIds.add(c._id.toString());
        });

        const itemsRes = await fetch(`${myApi}/items`, { headers: { 'Authorization': `Bearer ${token}` } });
        const itemsData = await itemsRes.json();
        const museumItems = (itemsData.items || []).filter(item => validContentIds.has(item.contentId));

        itemsContainer.innerHTML = '';
        if (museumItems.length > 0) {
            museumItems.forEach(item => {
                const itemTitle = (item.descriptions && item.descriptions[0]?.title) ? item.descriptions[0].title : `Opera (${item.contentId})`;
                const itemDiv = document.createElement('div');
                itemDiv.style.padding = '12px'; itemDiv.style.borderBottom = '1px solid #e2e8f0'; itemDiv.style.cursor = 'pointer'; itemDiv.style.display = 'flex'; itemDiv.style.justifyContent = 'space-between';
                itemDiv.innerHTML = `<strong>${itemTitle}</strong> <span style="color: var(--chil-grey);">${item.price > 0 ? item.price+'€' : 'Free'}</span>`;
                
                itemDiv.onclick = () => {
                    creaEdAggiungiItem(itemTitle, item._id, activeBlockList);
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

// --- DRAG & DROP INCROCIATO & CARTA CLICCABILE ---
let draggedItem = null;
let placeholder = document.createElement('li');
placeholder.className = 'placeholder';

function creaEdAggiungiItem(titoloOpera, itemId, targetList) {
    const li = document.createElement('li');
    li.classList.add('draggable-item');
    li.setAttribute('draggable', 'true');
    li.dataset.itemId = itemId; 

    li.innerHTML = `
        <div class="card-header">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="drag-handle" title="Drag">☰</span>
                <strong style="color: var(--charcoal); font-size: 1.05rem;">${titoloOpera}</strong>
            </div>
            <button class="delete-btn" title="Remove">✖</button>
        </div>
        <div class="card-details">
            <div class="card-image-placeholder">IMG</div>
            <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                <p style="margin: 0; font-size: 0.9rem;"><strong>Click here to edit</strong></p>
                <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: #64748b;">See this artwork's details.</p>
            </div>
        </div>
    `;

    // EVENTO CLICK: Naviga al file create_items.html
    li.addEventListener('click', function(e) {
        if(e.target.closest('.delete-btn') || e.target.closest('.drag-handle')) {
            return;
        }
        
        // SALVA LO STATO IN MEMORIA PRIMA DI CAMBIARE PAGINA
        salvaStatoTemporaneo();

        // Naviga passando ID opera, ID museo e Titolo (così create_items si apre subito col titolo corretto)
        window.location.href = `create_items.html?itemId=${itemId}&museumId=${museumId}&museumName=${encodeURIComponent(museumName)}&title=${encodeURIComponent(titoloOpera)}`;
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
    
    // Rimuoviamo il bottone "add-block-btn" per salvare solo i blocchi effettivi
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

window.addEventListener('DOMContentLoaded', () => {
    const savedState = sessionStorage.getItem('temp_visit_state');
    if (savedState) {
        const state = JSON.parse(savedState);
        if(document.getElementById('v-title')) document.getElementById('v-title').value = state.title;
        if(document.getElementById('v-desc')) document.getElementById('v-desc').value = state.desc;
        
        // Ricostruiamo i blocchi salvati prima del bottone "Add Section"
        const addBtn = document.getElementById('add-block-btn');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = state.blocks;
        
        Array.from(tempDiv.children).forEach(block => {
            blocksContainer.insertBefore(block, addBtn);
            
            // Riattacchiamo tutti gli eventi al blocco ripristinato
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
            
            // Riattacchiamo gli eventi alle singole carte
            block.querySelectorAll('.draggable-item').forEach(li => {
                const itemId = li.dataset.itemId;
                const titoloOpera = li.querySelector('strong').innerText; // Recuperiamo il titolo per l'URL

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
        sessionStorage.removeItem('temp_visit_state'); // Puliamo la memoria
    } else {
        // Se non c'era nessuno stato salvato, creiamo il primo blocco di default
        createNewBlock("Mainboard");
    }
});


// --- SALVATAGGIO DATABASE ---
document.getElementById('save-visit-btn').addEventListener('click', async () => {
    const title = document.getElementById('v-title').value;
    const desc = document.getElementById('v-desc').value;
    
    if (!title.trim()) { alert("Inserisci un titolo per la visita."); return; }

    const structurData = [];
    let flatSequence = []; 

    document.querySelectorAll('.visit-block').forEach(block => {
        const blockTitle = block.querySelector('.block-title-input').value;
        const itemsNodes = block.querySelectorAll('.draggable-item');
        const itemsIds = Array.from(itemsNodes).map(node => node.dataset.itemId);
        
        structurData.push({ blockName: blockTitle, items: itemsIds });
        flatSequence = flatSequence.concat(itemsIds);
    });

    if (flatSequence.length === 0) { alert("Aggiungi almeno un'opera alla visita."); return; }

    const payload = {
        title: title,
        description: desc + "\n\n[Struttura Blocchi Salvata: " + JSON.stringify(structurData) + "]",
        museumId: museumId,
        sequence: flatSequence,
        isPublic: false
    };

    console.log("Oggetto JSON pronto per l'invio:", payload);
    
    try {
        const res = await fetch(`${myApi}/visits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("Visita salvata con successo!");
            window.location.href = "../pages/visits_list.html?museumId=" + museumId + "&museumName=" + encodeURIComponent(museumName);
        } else {
            alert("Errore nel salvataggio. Controlla la console.");
        }
    } catch(err) {
        console.error(err);
    }
});