const myApi = "http://localhost:8000/api";
const token = localStorage.getItem("token");

if (!token) {
    alert("You must be logged in to access this page.");
    window.location.href = "loginpage.html";
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
    window.location.href = `museum-preview.html`; 
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

function toRoman(num) { //Vogliamo tenerla, c'è già il contatore a sx. Magari integriamola lì
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

function createNewBlock(defaultTitle) {
    blockCounter++;
    const block = document.createElement('div');
    block.className = 'visit-block';
    block.innerHTML = `
        <div class="block-header">
            <span class="block-number">${blockCounter}</span>
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
    const nextNum = document.querySelectorAll('.visit-block').length + 1;
    createNewBlock(` ${toRoman(nextNum)} `);
});

// Crea il primo blocco
createNewBlock(" I ");

// --- LOGICA ESPANSIONE CARTE ARCHIDEKT ---
function aggiornaStatoCarte() {
    document.querySelectorAll('.block-list').forEach(list => {
        const items = Array.from(list.children);
        
        // Rimuovi la classe a tutte
        items.forEach(item => {
            if (item.classList) item.classList.remove('is-last-item');
        });
        
        // Trova le carte reali
        const validItems = items.filter(item => 
            item.classList.contains('draggable-item') && !item.classList.contains('dragging')
        );
        
        if (validItems.length > 0) {
            const lastChild = items[items.length - 1];
            if (!lastChild.classList.contains('placeholder')) {
                // Assegna is-last-item all'ultima carta per permettere al CSS di gestirla
                validItems[validItems.length - 1].classList.add('is-last-item');
            }
        }
    });
}

function aggiornaContatoriBlocchi() {
    const blocks = document.querySelectorAll('.visit-block');
    blocks.forEach((block, index) => {
        block.querySelector('.block-number').textContent = index + 1;
        const itemCount = block.querySelectorAll('.draggable-item').length;
        block.querySelector('.block-count').textContent = `${itemCount} opere`;
    });
    aggiornaStatoCarte(); 
}

// --- LOGICA RECUPERO OPERE ---
async function apriModaleOpere() {
    itemModal.classList.remove('hidden');
    itemsContainer.innerHTML = '<p style="text-align:center;">Loading for server...</p>';

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
                itemDiv.innerHTML = `<strong>${itemTitle}</strong> <span style="color: #64748b;">${item.price > 0 ? item.price+'€' : 'Free'}</span>`;
                
                itemDiv.onclick = () => {
                    creaEdAggiungiItem(itemTitle, item._id, activeBlockList);
                    itemModal.classList.add('hidden');
                };
                itemsContainer.appendChild(itemDiv);
            });
        } else {
            itemsContainer.innerHTML = '<p style="text-align:center; color: #666;">No artworks found.</p>';
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

    // 1. EVENTO CLICK: Naviga al file create_items.html
    li.addEventListener('click', function(e) {
        // Ignora il click se premiamo il tasto X o la barra per trascinare
        if(e.target.closest('.delete-btn') || e.target.closest('.drag-handle')) {
            return;
        }
        // Naviga passando ID opera e ID museo!
        window.location.href = `create_items.html?itemId=${itemId}&museumId=${museumId}`;
    });

    // 2. EVENTO ELIMINAZIONE
    li.querySelector('.delete-btn').addEventListener('click', () => {
        li.remove();
        aggiornaContatoriBlocchi();
    });

    // 3. EVENTI TRASCINAMENTO
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
            window.location.href = "visits-list.html?museumId=" + museumId + "&museumName=" + encodeURIComponent(museumName);
        } else {
            alert("Errore nel salvataggio. Controlla la console.");
        }
    } catch(err) {
        console.error(err);
    }
});