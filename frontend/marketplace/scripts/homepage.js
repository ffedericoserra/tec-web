const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;

let allMuseums = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Aggiorniamo i link della navbar dinamicamente (se vogliamo)
    const addMuseumBtn = document.getElementById('nav-add-museum');
    if(addMuseumBtn) {
        addMuseumBtn.addEventListener('click', () => {
            const token = localStorage.getItem("token");
            if(!token) {
                alert("Devi effettuare il login per aggiungere un museo!");
                window.location.href = "login.html";
            } 
        });
    }

    await fetchMuseums();
    setupSearch();
});

// Chiamata PUBBLICA al database (nessun token inviato)
async function fetchMuseums() {
    try {
        const res = await fetch(`${myApi}/museums`);
        if (!res.ok) throw new Error("Errore dal server");
        
        const data = await res.json();
        allMuseums = data.museums || data;
        renderMuseums(allMuseums);
    } catch (err) {
        console.error("Errore nel caricamento musei:", err);
        document.getElementById('museum-list').innerHTML = '<p style="text-align:center;">Impossibile caricare i musei al momento.</p>';
    }
}

// Stampa le carte in stile wireframe
function renderMuseums(museums) {
    const container = document.getElementById('museum-list');
    container.innerHTML = '';

    if (museums.length === 0) {
        container.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">Nessun museo trovato.</p>';
        return;
    }

    museums.forEach(museum => {
        const card = document.createElement('div');
        
        // Stile Card Moderna
        card.style.borderRadius = '16px';
        card.style.background = 'var(--pure-white, #ffffff)';
        card.style.overflow = 'hidden'; // Importante per tagliare gli angoli dell'immagine
        card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.04)';
        card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        card.style.cursor = 'pointer';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';

        card.onmouseover = () => { 
            card.style.transform = 'translateY(-8px)'; 
            card.style.boxShadow = '0 15px 30px rgba(0,0,0,0.1)'; 
        };
        card.onmouseout = () => { 
            card.style.transform = 'translateY(0)'; 
            card.style.boxShadow = '0 4px 15px rgba(0,0,0,0.04)'; 
        };

        // Immagine di copertina casuale (placeholder) basata sull'ID per tenerla fissa
        const randomImgId = museum._id ? museum._id.charCodeAt(0) % 10 : 1;
        const imageUrl = museum.imageUrl || `https://images.unsplash.com/photo-1518998053401-a4149019a282?auto=format&fit=crop&w=600&q=80&sig=${randomImgId}`;

        // Contenuto: Immagine sopra, Testo sotto
        card.innerHTML = `
            <img class="museum-card-image" src="${imageUrl}" alt="${museum.name}">
            <div style="padding: 20px;">
                <span style="background: rgba(197, 160, 89, 0.1); color: var(--museum-gold); font-size: 0.75rem; padding: 5px 10px; border-radius: 20px; font-weight: bold; text-transform: uppercase;">Museo</span>
                <h3 style="margin: 10px 0 5px 0; font-size: 1.4rem; color: var(--charcoal); font-weight: 700;">${museum.name}</h3>
                <p style="margin: 0; font-size: 1rem; color: #64748b; display: flex; align-items: center; gap: 6px;">
                     ${museum.city || 'Destinazione'}
                </p>
            </div>
        `;

        card.addEventListener('click', () => {
            window.location.href = `visits_list.html?museumId=${museum._id}&museumName=${encodeURIComponent(museum.name)}`;
        });

        container.appendChild(card);
    });
}

// Logica per la barra di ricerca
function setupSearch() {
    const searchBar = document.getElementById('search-bar');
    searchBar.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allMuseums.filter(m =>
            m.name.toLowerCase().includes(term) ||
            (m.city && m.city.toLowerCase().includes(term))
        );
        renderMuseums(filtered);
    });
}
