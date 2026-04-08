const myApi = "http://localhost:8000/api";
const token = localStorage.getItem("token");

if (!token) {
    alert("Devi effettuare l'accesso per creare una visita.");
    window.location.href = "loginpage.html";
}

// 1. Recupero parametri URL
const urlParams = new URLSearchParams(window.location.search);
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName');

const displayMuseumEl = document.getElementById('display-museum-name');
if (displayMuseumEl) {
    displayMuseumEl.innerText = museumName || "Nessun museo selezionato";
}

// Azione tasto Esci
document.getElementById('exit-btn').addEventListener('click', () => {
    window.location.href = `museum-preview.html`; 
});

const visitList = document.getElementById('visit-list');
const addItemBtn = document.getElementById('add-item-btn');
const itemModal = document.getElementById('select-item-modal');
const closeItemModalBtn = document.getElementById('close-item-modal');
const itemsContainer = document.getElementById('items-container');

// 2. Apri modale e fai Fetch filtrata per Museo
addItemBtn.addEventListener('click', async () => {
    if(!museumId) {
        alert("Nessun museo selezionato. Impossibile caricare gli item.");
        return;
    }

    itemModal.classList.remove('hidden');
    itemsContainer.innerHTML = '<p style="text-align:center;">Caricamento item dal server...</p>';

    try {
        // Passiamo il museumId alla rotta backend
        const res = await fetch(`${myApi}/items?museumId=${museumId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        itemsContainer.innerHTML = '';
        
        // Applichiamo anche un filtro locale di sicurezza, qualora la rotta del backend 
        // non sia ancora stata aggiornata per recepire "?museumId="
        const allItems = data.items || [];
        const filteredItems = allItems.filter(item => {
            // Se nel DB c'è un campo museumId associato all'item, mostra solo quelli corrispondenti
            return item.museumId === museumId || !item.museumId; 
        });
        
        if (filteredItems.length > 0) {
            filteredItems.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.style.padding = '10px';
                itemDiv.style.borderBottom = '1px solid #ddd';
                itemDiv.style.cursor = 'pointer';
                itemDiv.style.display = 'flex';
                itemDiv.style.justifyContent = 'space-between';
                
                const itemTitle = (item.descriptions && item.descriptions[0]?.title) ? item.descriptions[0].title : `Item (${item.contentId || item._id})`;
                const priceText = item.price > 0 ? `${item.price}€` : 'Gratis';
                
                itemDiv.innerHTML = `<strong>${itemTitle}</strong> <span style="color:#666;">${priceText}</span>`;
                
                itemDiv.onclick = () => {
                    creaEdAggiungiItem(itemTitle, item._id, priceText);
                    itemModal.classList.add('hidden');
                };
                itemsContainer.appendChild(itemDiv);
            });
        } else {
            itemsContainer.innerHTML = '<p style="text-align:center; color: #666;">Nessun item trovato per questo museo.</p>';
        }
    } catch (err) {
        itemsContainer.innerHTML = '<p style="text-align:center; color: #d9534f;">Errore nel recupero degli item.</p>';
        console.error("Fetch items error:", err);
    }
});

closeItemModalBtn.addEventListener('click', () => {
    itemModal.classList.add('hidden');
});

// Funzione fondamentale: Ricalcola i numeri della scaletta in ordine
function updateItemNumbers() {
    const listItems = visitList.querySelectorAll('.draggable-item');
    listItems.forEach((item, index) => {
        const counterSpan = item.querySelector('.item-counter');
        if (counterSpan) {
            counterSpan.textContent = index + 1; // 1, 2, 3...
        }
    });
}

// 3. Creazione fisica dell'elemento nella lista
function creaEdAggiungiItem(titoloOpera, itemId, priceText) {
    const li = document.createElement('li');
    li.classList.add('draggable-item');
    li.setAttribute('draggable', 'true');
    li.dataset.itemId = itemId; 

    // Struttura Flexbox allineata
    li.innerHTML = `
        <div class="item-left">
            <span class="drag-handle">☰</span>
            <span class="item-counter">0</span>
            <span style="font-weight: bold; color: var(--charcoal);">${titoloOpera}</span>
        </div>
        <div class="item-right">
            <span style="color:#888; font-size: 0.9em;">${priceText}</span>
            <button class="delete-btn">X</button>
        </div>
    `;

    // Eliminazione Item
    li.querySelector('.delete-btn').addEventListener('click', () => {
        li.remove();
        updateItemNumbers(); // Ricalcola dopo aver cancellato
    });

    // Drag & Drop
    li.addEventListener('dragstart', function() {
        setTimeout(() => this.classList.add('dragging'), 0);
    });
    li.addEventListener('dragend', function() {
        setTimeout(() => {
            this.classList.remove('dragging');
            updateItemNumbers(); // Ricalcola dopo lo spostamento
        }, 0);
    });

    visitList.appendChild(li);
    updateItemNumbers(); // Calcola all'inserimento
}

// Eventi Contenitore Drag&Drop
visitList.addEventListener('dragover', function(e) {
    e.preventDefault();
    const draggingElement = document.querySelector('.dragging');
    if (!draggingElement) return;
    const afterElement = getDragAfterElement(visitList, e.clientY);
    if (afterElement == null) {
        visitList.appendChild(draggingElement);
    } else {
        visitList.insertBefore(draggingElement, afterElement);
    }
});

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