// --- CONFIGURAZIONE ---
const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token");

if (!token) window.location.href = "../pages/login.html";

// 1. LEGGIAMO I DATI DALL'URL
const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('itemId');
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName');
const urlTitle = urlParams.get('title');
const urlAuthor = urlParams.get('author');
const urlImage = urlParams.get('image');

// --- SISTEMA DI TOAST NOTIFICATIONS (Pop-up fluidi) ---
function showToast(message, type = "success") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    
    container.appendChild(toast);
    
    // Entrata fluida
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Uscita fluida dopo 3.5 secondi
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); // Aspetta la fine dell'animazione CSS
    }, 3500);
}

// --- GESTIONE DELLE TABS (Toni) ---
document.querySelectorAll('.tone-tab').forEach(button => {
    button.addEventListener('click', () => {
        // Rimuove attivo da tutti
        document.querySelectorAll('.tone-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tone-tab-content').forEach(c => c.classList.remove('active'));
        
        // Attiva quello cliccato
        button.classList.add('active');
        const targetId = button.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
    });
});

// --- POPOLIAMO LA GRAFICA ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('back-to-visit-btn').href = `create_visits.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
    
    document.getElementById('artwork-title').textContent = urlTitle || "Titolo Sconosciuto";
    document.getElementById('artwork-author').textContent = urlAuthor || "Autore Ignoto";
    document.getElementById('artwork-id').textContent = `ID: ${itemId}`;

    const imgContainer = document.getElementById('artwork-img-container');
    if (urlImage) {
        const finalImgUrl = urlImage.startsWith('http') ? urlImage : `${baseUrl}${urlImage.startsWith('/') ? '' : '/'}${urlImage}`;
        imgContainer.innerHTML = `<img src="${finalImgUrl}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
        imgContainer.innerHTML = `<span style="color:var(--chill-grey)">Nessuna immagine</span>`;
    }

    caricaTestiDaDB();
});

// Chiamata per riempire la matrice
async function caricaTestiDaDB() {
    try {
        const res = await fetch(`${myApi}/items/${itemId}`, { 
            headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        if (!res.ok) throw new Error("Errore nel recupero testi");
        const data = await res.json();
        const currentItem = data.item || data; 

        if (document.getElementById('item-public-toggle')) {
            document.getElementById('item-public-toggle').value = currentItem.isPublic ? "true" : "false";
        }

        // Se ci sono descrizioni, le inseriamo nei posti giusti della matrice
        if (currentItem.descriptions && currentItem.descriptions.length > 0) {
            currentItem.descriptions.forEach(descGroup => {
                const tone = descGroup.tone; // "easy", "medium", o "complex"
                if(descGroup.texts && descGroup.texts.length > 0) {
                    descGroup.texts.forEach(txtObj => {
                        const length = txtObj.lengthCategory; // "3s", "15s", "45s"
                        // Cerchiamo la casella di testo esatta per questa combinazione
                        const inputEl = document.querySelector(`.matrix-input[data-tone="${tone}"][data-length="${length}"]`);
                        if (inputEl) {
                            inputEl.value = txtObj.text || "";
                        }
                    });
                }
            });
        }
    } catch (error) {
        console.error("Errore Database:", error);
        showToast("Errore di connessione al server", "error");
    }
}

// --- SALVATAGGIO DEI DATI ---
document.getElementById('save-item-btn').addEventListener('click', async () => {
    const isPublic = document.getElementById('item-public-toggle').value === "true";
    
    // Inizializziamo l'oggetto raggruppato per Toni
    const groupedDescriptions = {
        easy: [],
        medium: [],
        complex: []
    };
    
    // Leggiamo tutte le textareas della nostra matrice
    const allInputs = document.querySelectorAll('.matrix-input');
    allInputs.forEach(input => {
        const tone = input.getAttribute('data-tone');
        const length = input.getAttribute('data-length');
        const text = input.value.trim();
        
        // Salviamo solo se l'utente ha effettivamente scritto qualcosa
        if (text !== "") {
            groupedDescriptions[tone].push({
                text: text,
                lengthCategory: length,
                language: "it" // Manteniamo default ita per ora
            });
        }
    });

    // Formattiamo per il database scartando i toni rimasti completamente vuoti
    const finalDescriptions = [];
    Object.keys(groupedDescriptions).forEach(tone => {
        if (groupedDescriptions[tone].length > 0) {
            finalDescriptions.push({
                tone: tone,
                texts: groupedDescriptions[tone]
            });
        }
    });

    try {
        const res = await fetch(`${myApi}/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ isPublic: isPublic, descriptions: finalDescriptions })
        });

        if (res.ok) {
            showToast("Modifiche salvate con successo!", "success");
            // Ritardiamo leggermente il ritorno alla pagina precedente per far vedere il toast
            setTimeout(() => {
                window.location.href = `create_visits.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
            }, 1500);
        } else {
            showToast("Impossibile salvare le modifiche.", "error");
        }
    } catch (error) {
        console.error("Save Error:", error);
        showToast("Errore di rete.", "error");
    }
});