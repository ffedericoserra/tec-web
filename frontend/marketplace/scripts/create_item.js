const myApi = "http://localhost:8000/api";
const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "../loginpage.html"; 
}

const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('itemId');
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName');
const passedTitle = urlParams.get('title'); // Cattura il titolo se passato!

// Pre-compila istantaneamente il titolo per non far aspettare l'utente
if (passedTitle) {
    document.getElementById('disp-title').innerText = decodeURIComponent(passedTitle);
}

let originalPrice = 0;
let originalTarget = "";
let currentTone = 'easy';
let currentLength = '3s';

const itemData = {
    easy:    { enabled: false, texts: { '3s': '', '15s': '', '45s': '' } },
    medium:  { enabled: false, texts: { '3s': '', '15s': '', '45s': '' } },
    complex: { enabled: false, texts: { '3s': '', '15s': '', '45s': '' } }
};

// === GESTIONE MODALI E PULSANTI HEADER/BOTTOM ===
function tornaAllaVisita() {
    window.location.href = `create_visits.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
}

const cancelModal = document.getElementById('cancel-confirm-modal');

// Apri modale sia dal bottone in alto che da quello in basso
document.getElementById('back-to-visit-btn').addEventListener('click', () => cancelModal.classList.remove('hidden'));
document.getElementById('cancel-btn').addEventListener('click', () => cancelModal.classList.remove('hidden'));

// Azioni dentro la modale
document.getElementById('confirm-exit-btn').addEventListener('click', tornaAllaVisita);
document.getElementById('confirm-save-btn').addEventListener('click', () => {
    cancelModal.classList.add('hidden');
    document.getElementById('save-item-btn').click(); 
});
document.getElementById('close-cancel-modal').addEventListener('click', () => {
    cancelModal.classList.add('hidden');
});

// === CHIAMATA AL DATABASE ===
async function caricaDatiItem() {
    if (!itemId) return;

    try {
        // 1. Fetch Item usando la rotta diretta
        const resItem = await fetch(`${myApi}/items/${itemId}`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (!resItem.ok) return;
        
        const dataItem = await resItem.json();
        const item = dataItem.item;
        
        if (!item) return;

        originalPrice = item.price || 0;
        originalTarget = item.targetAudience || 'Non specificato';

        document.getElementById('disp-price').innerText = originalPrice > 0 ? `${originalPrice} €` : 'Gratis';
        document.getElementById('disp-target').innerText = originalTarget;

        // 2. Fetch dei contenuti del museo per abbinare le info mancanti
        const resContents = await fetch(`${myApi}/museums/${museumId}/contents`, { headers: { 'Authorization': `Bearer ${token}` }});
        const dataContents = await resContents.json();
        
        const relatedContent = (dataContents.contents || []).find(c => 
            c.universalId === item.contentId || c._id === item.contentId
        );

        if (relatedContent) {
            // Se non era stato passato un titolo dall'URL, lo mette ora
            if (!passedTitle) document.getElementById('disp-title').innerText = relatedContent.name || "Senza Titolo";
            
            document.getElementById('disp-author').innerText = relatedContent.author || "Autore Ignoto";
            document.getElementById('disp-year').innerText = relatedContent.year || "Non specificato";
            
            if (relatedContent.imageUrl) {
                const finalImgUrl = relatedContent.imageUrl.startsWith('http') ? relatedContent.imageUrl : `http://localhost:8000${relatedContent.imageUrl.startsWith('/') ? '' : '/'}${relatedContent.imageUrl}`;
                document.getElementById('disp-image').innerHTML = `<img src="${finalImgUrl}" style="width:100%; height:100%; object-fit:cover;" onerror="this.parentElement.innerHTML='Immagine non valida'"/>`;
                document.getElementById('disp-image').style.border = "none";
            } else {
                document.getElementById('disp-image').innerHTML = `<span style="font-size:0.9rem;">Nessuna immagine</span>`;
            }
        }

        // 3. Estrapola i testi dalle descrizioni e riempie l'editor
        if (item.descriptions && item.descriptions.length > 0) {
            item.descriptions.forEach(desc => {
                const tone = desc.tone; 
                if (itemData[tone]) {
                    itemData[tone].enabled = true; 
                    // Spunta visivamente la checkbox corretta
                    const toneBar = document.querySelector(`.tone-bar[data-tone="${tone}"]`);
                    if(toneBar) toneBar.querySelector('.tone-checkbox').checked = true;
                    
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

caricaDatiItem();

// === GESTIONE INTERFACCIA EDITOR TESTI ===
const textEditor = document.getElementById('main-text-editor');
const warningDisabled = document.getElementById('warning-disabled');
const currentToneDisplay = document.getElementById('current-tone-display');

textEditor.addEventListener('input', (e) => {
    itemData[currentTone].texts[currentLength] = e.target.value;
});

// Cambia stato spunta
document.querySelectorAll('.tone-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', (e) => e.stopPropagation()); 
    checkbox.addEventListener('change', (e) => {
        const tone = e.target.closest('.tone-bar').dataset.tone;
        itemData[tone].enabled = e.target.checked;
        if(tone === currentTone) aggiornaEditorTesto();
    });
});

// Cambia Tono attivo
document.querySelectorAll('.tone-bar').forEach(bar => {
    bar.addEventListener('click', () => {
        document.querySelectorAll('.tone-bar').forEach(b => b.classList.remove('active'));
        bar.classList.add('active');
        currentTone = bar.dataset.tone;
        aggiornaEditorTesto();
    });
});

// Cambia Lunghezza attiva
document.querySelectorAll('.length-btn').forEach(btn => {
    btn.addEventListener('click', () => {
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

// === SALVATAGGIO DATABASE ===
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
            alert("Salvato con successo!");
            tornaAllaVisita(); 
        } else {
            alert("Errore nel salvataggio.");
        }
    } catch (error) {
        console.error(error);
    }
});