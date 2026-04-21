const myApi = "http://localhost:8000/api";
const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "loginpage.html";
}

// Parametri URL
const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('itemId');
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName');

// --- DATI DA SALVAGUARDARE IN BACKGROUND ---
// Questi non possono essere modificati dall'interfaccia, 
// ma li teniamo in memoria per rimetterli nel payload quando salviamo.
let originalPrice = 0;
let originalTarget = "";

// --- STATO DELL'EDITOR TESTI IN MEMORIA ---
let currentTone = 'easy';
let currentLength = '3s';

const itemData = {
    easy:    { enabled: false, texts: { '3s': '', '15s': '', '45s': '' } },
    medium:  { enabled: false, texts: { '3s': '', '15s': '', '45s': '' } },
    complex: { enabled: false, texts: { '3s': '', '15s': '', '45s': '' } }
};

// --- LOGICA NAVIGAZIONE E MODALE ANNULLA ---
function tornaAllaVisita() {
    window.location.href = `create_visits.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
}

const cancelModal = document.getElementById('cancel-confirm-modal');

document.getElementById('back-to-visit-btn').addEventListener('click', () => cancelModal.classList.remove('hidden'));
document.getElementById('cancel-btn').addEventListener('click', () => cancelModal.classList.remove('hidden'));

document.getElementById('confirm-exit-btn').addEventListener('click', tornaAllaVisita);
document.getElementById('confirm-save-btn').addEventListener('click', () => {
    cancelModal.classList.add('hidden');
    document.getElementById('save-item-btn').click(); 
});
document.getElementById('close-cancel-modal').addEventListener('click', () => {
    cancelModal.classList.add('hidden');
});

// --- CARICAMENTO DATI DAL DATABASE ---
async function caricaDatiItem() {
    try {
        // 1. Fetch dell'Item
        const resItem = await fetch(`${myApi}/items?_id=${itemId}`, { headers: { 'Authorization': `Bearer ${token}` }});
        const dataItem = await resItem.json();
        const item = dataItem.items.find(i => i._id === itemId);
        
        if (!item) return;

        // Salviamo in memoria i dati intoccabili
        originalPrice = item.price || 0;
        originalTarget = item.targetAudience || 'Non specificato';

        // Stampa i dati dell'Item nella Carta
        document.getElementById('disp-price').innerText = originalPrice > 0 ? `${originalPrice} €` : 'Gratis';
        document.getElementById('disp-target').innerText = originalTarget;

        // 2. Fetch del Content (Autore, Titolo, Anno, Immagine)
        let contentName = "Opera Senza Titolo";
        let contentAuthor = "Autore Ignoto";
        let contentYear = "Anno non specificato";
        let imageUrl = null;

        const resContents = await fetch(`${myApi}/museums/${museumId}/contents`, { headers: { 'Authorization': `Bearer ${token}` }});
        const dataContents = await resContents.json();
        
        const relatedContent = (dataContents.contents || []).find(c => 
            c.universalId === item.contentId || c._id.toString() === item.contentId
        );

        if (relatedContent) {
            contentName = relatedContent.name || contentName;
            contentAuthor = relatedContent.author || contentAuthor;
            contentYear = relatedContent.year || contentYear;
            imageUrl = relatedContent.imageUrl; // Assumendo che esista nel db
        }

        // Stampa a schermo i dati del Content
        document.getElementById('disp-title').innerText = contentName;
        document.getElementById('disp-author').innerText = contentAuthor;
        document.getElementById('disp-year').innerText = contentYear;
        
        if (imageUrl) {
            document.getElementById('disp-image').innerHTML = `<img src="${imageUrl}" alt="Immagine dell'opera">`;
        }
        
        // 3. Estrapola i testi e riempie la matrice `itemData`
        if (item.descriptions && item.descriptions.length > 0) {
            item.descriptions.forEach(desc => {
                const tone = desc.tone; 
                if (itemData[tone]) {
                    itemData[tone].enabled = true; 
                    document.getElementById(`check-${tone}`).checked = true;
                    
                    desc.texts.forEach(t => {
                        if (itemData[tone].texts[t.lengthCategory] !== undefined) {
                            itemData[tone].texts[t.lengthCategory] = t.text;
                        }
                    });
                }
            });
        }
        
        aggiornaEditorTesto();
        
    } catch (err) {
        console.error("Errore caricamento dati:", err);
    }
}

// Avvia il caricamento all'apertura
caricaDatiItem();

// --- LOGICA DELL'INTERFACCIA (Toni, Lunghezze, Testi) ---
const textEditor = document.getElementById('main-text-editor');
const warningDisabled = document.getElementById('warning-disabled');
const currentToneDisplay = document.getElementById('current-tone-display');

// Salva ad ogni tasto premuto
textEditor.addEventListener('input', (e) => {
    itemData[currentTone].texts[currentLength] = e.target.value;
});

// Click sulle Spunte
document.querySelectorAll('.tone-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', (e) => e.stopPropagation()); 
    checkbox.addEventListener('change', (e) => {
        const tone = e.target.closest('.tone-bar').dataset.tone;
        itemData[tone].enabled = e.target.checked;
        if(tone === currentTone) aggiornaEditorTesto();
    });
});

// Click sulle Barre dei Toni (A sinistra)
document.querySelectorAll('.tone-bar').forEach(bar => {
    bar.addEventListener('click', (e) => {
        document.querySelectorAll('.tone-bar').forEach(b => b.classList.remove('active'));
        bar.classList.add('active');
        currentTone = bar.dataset.tone;
        aggiornaEditorTesto();
    });
});

// Click sulle Lunghezze (Sopra il testo)
document.querySelectorAll('.length-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.length-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLength = btn.dataset.length;
        aggiornaEditorTesto();
    });
});

function aggiornaEditorTesto() {
    textEditor.value = itemData[currentTone].texts[currentLength] || '';
    
    if (itemData[currentTone].enabled) {
        warningDisabled.style.display = 'none';
    } else {
        warningDisabled.style.display = 'block';
    }
    
    const toneNames = { easy: "Semplice", medium: "Intermedio", complex: "Esperto" };
    currentToneDisplay.innerText = `Stai modificando: Tono ${toneNames[currentTone]}`;
}

// --- SALVATAGGIO FINALE NEL DATABASE ---
document.getElementById('save-item-btn').addEventListener('click', async () => {
    
    const descriptionsPayload = [];
    
    for (const [toneKey, toneData] of Object.entries(itemData)) {
        if (toneData.enabled) {
            const textsArray = [];
            for (const [lenKey, testVal] of Object.entries(toneData.texts)) {
                if (testVal.trim() !== '') {
                    textsArray.push({ lengthCategory: lenKey, text: testVal.trim(), language: 'it' });
                }
            }
            if (textsArray.length > 0) {
                descriptionsPayload.push({
                    tone: toneKey,
                    texts: textsArray
                });
            }
        }
    }

    // Invia i testi nuovi, ma MANTIENE il prezzo e il target originali!
    const payload = {
        targetAudience: originalTarget,
        price: originalPrice,
        descriptions: descriptionsPayload
    };

    try {
        const res = await fetch(`${myApi}/items/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("Testi aggiornati e salvati con successo!");
            tornaAllaVisita(); 
        } else {
            alert("Errore nel salvataggio dell'opera sul database.");
        }
    } catch (error) {
        console.error(error);
    }
});