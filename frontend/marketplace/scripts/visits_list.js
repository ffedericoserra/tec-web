const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;

const visitsContainer = document.getElementById("tours-list");
const searchBar = document.querySelector("#search-bar");

// Query specifiche del museo selezionato dall'URL
const urlParams = new URLSearchParams(window.location.search);
const currMuseumId = urlParams.get('museumId');
const currMuseumName = urlParams.get('museumName');

console.log("Stiamo lavorando sul museo:", currMuseumName, "con ID:", currMuseumId);

let allTours = [];

function setUpMuseumDatas(){
    const titolo = document.getElementById("museum-title-display") || document.querySelector(".title");
    if(titolo && currMuseumName) titolo.innerHTML = currMuseumName;
}

function renderVisitsList(visitsArr) {
    visitsContainer.innerHTML = "";

    if(visitsArr.length === 0){
        visitsContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--chill-grey); font-size: 1.1rem; padding: 40px;">No visits found for this museum.</p>`;
        return;
    }
    
    visitsArr.forEach(v => {
        // 1. LA MAGIA: Puliamo la descrizione nascondendo i dati tecnici
        let cleanDesc = v.description || "";
        const splitTag = "[Struttura Blocchi Salvata: ";
        if (cleanDesc.includes(splitTag)) {
            cleanDesc = cleanDesc.split(splitTag)[0].trim();
        }
        if (!cleanDesc) cleanDesc = "Nessuna descrizione fornita per questo tour.";

        // 2. Creiamo il blocco card
        const visitIcon = document.createElement("div");
        visitIcon.className = "visit-card-modern"; 
        
        // Stile della card (mantenuto in linea dal tuo codice originale)
        visitIcon.style.display = "flex";
        visitIcon.style.flexDirection = "column";
        visitIcon.style.position = "relative"; // Aggiunto per posizionare il cuore in modo assoluto
        visitIcon.style.background = "var(--pure-white, #FFFFFF)";
        visitIcon.style.border = "1px solid var(--border-light, #E2E8F0)";
        visitIcon.style.borderRadius = "16px";
        visitIcon.style.padding = "24px";
        visitIcon.style.boxShadow = "0 2px 10px rgba(0,0,0,0.02)";
        visitIcon.style.transition = "transform 0.2s ease, box-shadow 0.2s ease";
        visitIcon.style.minHeight = "220px";

        visitIcon.onmouseover = () => {
            visitIcon.style.transform = "translateY(-4px)";
            visitIcon.style.boxShadow = "0 12px 24px rgba(0,0,0,0.08)";
        };
        visitIcon.onmouseout = () => {
            visitIcon.style.transform = "translateY(0)";
            visitIcon.style.boxShadow = "0 2px 10px rgba(0,0,0,0.02)";
        };

        // Struttura HTML interna con il nuovo bottone preferiti
        visitIcon.innerHTML = `
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: url('https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?auto=format&fit=crop&w=600&q=80') center/cover; opacity: 0.15; z-index: 0;"></div>

            <button class="favorite-visit-btn">
                <span class="heart-icon">♡</span>
            </button>

            <div style="flex-grow: 1; position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                <span style="background: var(--charcoal); color: white; font-size: 0.7rem; padding: 4px 10px; border-radius: 12px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px;">Tour</span>
                <h3 style="color: var(--charcoal); margin: 0; font-size: 1.6rem; font-weight: 800; line-height: 1.2; text-shadow: 0 2px 4px rgba(255,255,255,0.8);">${v.title}</h3>
            </div>

            <div class="visit-card-overlay">
                <h3 style="color: var(--charcoal); margin-top: 0; font-size: 1.2rem; border-bottom: 2px solid var(--museum-gold); padding-bottom: 5px; display: inline-block;">${v.title}</h3>
                <p style="color: #333; font-size: 0.95rem; line-height: 1.5; margin-top: 10px; overflow-y: auto; max-height: 100px;">
                    ${cleanDesc}
                </p>
                
                <div style="display: flex; gap: 10px; width: 100%; margin-top: auto; padding-top: 15px;">
                    <button class="start-btn" style="flex: 2; background-color: var(--museum-gold); color: white; border: none; border-radius: 8px; padding: 10px 0; font-weight: 700; cursor: pointer; text-transform: uppercase;">
                        Start
                    </button>
                    <button class="edit-btn" style="flex: 1; background-color: var(--charcoal); color: white; border: none; border-radius: 8px; padding: 10px 0; font-weight: 700; cursor: pointer; text-transform: uppercase;">
                        Edit
                    </button>
                    <button class="delete-btn" style="flex: 0.5; background-color: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 8px; cursor: pointer; font-size: 1.1rem;">
                        🗑️
                    </button>
                </div>
            </div>
        `;

        const editBtn = visitIcon.querySelector(".edit-btn");
        const startBtn = visitIcon.querySelector(".start-btn");
        const deleteBtn = visitIcon.querySelector(".delete-btn");
        const favBtn = visitIcon.querySelector(".favorite-visit-btn");
        const heartIcon = visitIcon.querySelector(".heart-icon");

        // TOGGLE PREFERITI
        favBtn.onclick = async (e) => {
            e.stopPropagation(); // Evita conflitti con eventuali click sulla card
            const token = localStorage.getItem("token");
            
            if (!token) {
                alert("Devi effettuare il login per salvare una visita nei preferiti.");
                window.location.href = "login.html";
                return;
            }

            favBtn.disabled = true;

            try {
                const res = await fetch(`${myApi}/auth/favorites/visits/${v._id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.isSaved) {
                        heartIcon.innerText = "♥";
                        heartIcon.classList.add("saved");
                    } else {
                        heartIcon.innerText = "♡";
                        heartIcon.classList.remove("saved");
                    }
                } else {
                    console.error("Errore risposta server");
                }
            } catch (err) {
                console.error("Errore rete nel salvataggio della visita:", err);
            } finally {
                favBtn.disabled = false;
            }
        };

        // START TOUR (Pubblico)
        startBtn.onclick = (e) => {
            e.stopPropagation();
            window.location.href = `navigator.html?museumId=${currMuseumId}&visitId=${v._id}`;
        };

        // EDIT TOUR (Richiede Login)
        editBtn.onclick = (e) => {
            e.stopPropagation();
            const token = localStorage.getItem("token");
            if (!token) {
                alert("Devi effettuare il login per modificare una visita.");
                window.location.href = "login.html";
                return;
            }
            window.location.href = `create_visits.html?museumId=${currMuseumId}&museumName=${encodeURIComponent(currMuseumName)}&visitId=${v._id}`;
        };

        // DELETE TOUR (Richiede Login + Modale Custom)
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            const token = localStorage.getItem("token");
            
            if (!token) {
                alert("Devi effettuare il login per eliminare una visita.");
                window.location.href = "login.html";
                return;
            }

            const deleteModal = document.getElementById("delete-confirm-modal");
            const deleteText = document.getElementById("delete-modal-text");
            const confirmBtn = document.getElementById("confirm-delete-btn");
            const cancelBtn = document.getElementById("cancel-delete-btn");

            deleteText.innerHTML = `Sei sicuro di voler eliminare la visita<br><strong style="color: var(--charcoal); font-size: 1.2rem;">"${v.title}"</strong>?<br><span style="font-size: 0.9rem; color: #64748b; display: block; margin-top: 10px;">Questa azione è irreversibile.</span>`;
            deleteModal.classList.remove("hidden");

            cancelBtn.onclick = () => {
                deleteModal.classList.add("hidden");
            };

            confirmBtn.onclick = async () => {
                try {
                    confirmBtn.innerHTML = "Eliminazione...";
                    confirmBtn.style.opacity = "0.7";
                    confirmBtn.disabled = true;

                    const res = await fetch(`${myApi}/visits/${v._id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    if (res.ok) {
                        deleteModal.classList.add("hidden");
                        loadList(); 
                    } else {
                        const errorData = await res.json();
                        alert(`Impossibile eliminare: ${errorData.error || "Non sei autorizzato"}`);
                        deleteModal.classList.add("hidden");
                    }
                } catch (err) {
                    console.error("Errore eliminazione:", err);
                    alert("Errore di rete.");
                    deleteModal.classList.add("hidden");
                } finally {
                    confirmBtn.innerHTML = "Elimina";
                    confirmBtn.style.opacity = "1";
                    confirmBtn.disabled = false;
                }
            };
        };

        visitsContainer.appendChild(visitIcon);
    });
}

// CARICAMENTO PUBBLICO DAL DATABASE
async function loadList(){
    if(!currMuseumId){
        visitsContainer.innerHTML = "<p style='color: red; text-align: center;'>Errore: ID museo mancante.</p>";
        return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
        visitsContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: var(--gallery-bg); border-radius: 12px;">
                <h3 style="color: var(--charcoal); margin-bottom: 15px;">Vuoi esplorare le visite?</h3>
                <p style="color: var(--chill-grey); margin-bottom: 20px;">Devi effettuare il login per visualizzare o creare i tour di questo museo.</p>
                <button class="main-btn" onclick="window.location.href='login.html'">Vai al Login</button>
            </div>
        `;
        return; 
    }
    
    try {
        const res = await fetch(`${myApi}/visits/my?museumId=${currMuseumId}`, {
            headers: {
                "Authorization": `Bearer ${token}` 
            }
        });

        if (!res.ok) throw new Error("Errore dal server o token scaduto");

        const data = await res.json();
        allTours = data.visits || data || [];
        renderVisitsList(allTours);
        
    } catch(err){
        console.error("Errore durante il caricamento delle visite: " + err);
        visitsContainer.innerHTML = "<p style='color: var(--error-red); grid-column: 1 / -1; text-align: center;'>Errore di connessione. Prova a effettuare nuovamente il login.</p>";
    }
}

function setupSearchListeners() {
    if(!searchBar) return;
    searchBar.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const filteredArr = allTours.filter(visit => {
            const matchingName = visit.title && visit.title.toLowerCase().includes(searchTerm);
            const matchingDesc = visit.description && visit.description.toLowerCase().includes(searchTerm);

            return matchingName || matchingDesc;
        });

        renderVisitsList(filteredArr);
    });
}

function setupAddVisitBtn(){
    const addNewVisitBtn = document.getElementById("add-visit-btn");

    if (addNewVisitBtn) {
        addNewVisitBtn.addEventListener('click', () => {
            const token = localStorage.getItem("token");
            
            if (!token) {
                alert("Devi registrarti o effettuare il login per creare una nuova visita!");
                window.location.href = "login.html";
                return;
            }
            
            window.location.href = `create_visits.html?museumId=${currMuseumId}&museumName=${encodeURIComponent(currMuseumName)}`;
        });
    }
}

// Avviamo tutto
setUpMuseumDatas();
loadList();
setupSearchListeners();
setupAddVisitBtn();