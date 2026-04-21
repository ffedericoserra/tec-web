const myApi = "http://localhost:8000/api";
const token = localStorage.getItem("token");

if (!token) {
    window.location.href = "../loginpage.html"; 
}

const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('itemId');
const museumId = urlParams.get('museumId');
const museumName = urlParams.get('museumName');

let originalPrice = 0;
let originalTarget = "";
let currentTone = 'easy';
let currentLength = '3s';

const itemData = {
    easy:    { enabled: false, texts: { '3s': '', '15s': '', '45s': '' } },
    medium:  { enabled: false, texts: { '3s': '', '15s': '', '45s': '' } },
    complex: { enabled: false, texts: { '3s': '', '15s': '', '45s': '' } }
};

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

async function caricaDatiItem() {
    try {
        const resItem = await fetch(`${myApi}/items?_id=${itemId}`, { headers: { 'Authorization': `Bearer ${token}` }});
        const dataItem = await resItem.json();
        const item = dataItem.items.find(i => i._id === itemId);
        
        if (!item) return;

        originalPrice = item.price || 0;
        originalTarget = item.targetAudience || 'Non specificato';

        document.getElementById('disp-price').innerText = originalPrice > 0 ? `${originalPrice} €` : 'Gratis';
        document.getElementById('disp-target').innerText = originalTarget;

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
            imageUrl = relatedContent.imageUrl; 
        }

        document.getElementById('disp-title').innerText = contentName;
        document.getElementById('disp-author').innerText = contentAuthor;
        document.getElementById('disp-year').innerText = contentYear;
        
        // --- FIX IMMAGINE: Assicura che il path sia corretto collegandosi al server ---
        if (imageUrl) {
            // Se l'immagine è un link esterno (es. imgur, cloudinary), la usiamo così.
            // Se è un link locale al server (es. /uploads/image.jpg), attacchiamo l'indirizzo base del backend
            const finalImgUrl = imageUrl.startsWith('http') ? imageUrl : `http://localhost:8000${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
            
            document.getElementById('disp-image').innerHTML = `<img src="${finalImgUrl}" alt="Immagine dell'opera" onerror="this.parentElement.innerHTML='<span style=\\'font-size:0.9rem;\\'>Immagine<br>non trovata</span>'">`;
            document.getElementById('disp-image').style.border = "none";
        } else {
            document.getElementById('disp-image').innerHTML = `<span style="font-size:0.9rem;">Nessuna immagine<br>nel Database</span>`;
        }
        
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

caricaDatiItem();

const textEditor = document.getElementById('main-text-editor');
const warningDisabled = document.getElementById('warning-disabled');
const currentToneDisplay = document.getElementById('current-tone-display');

textEditor.addEventListener('input', (e) => {
    itemData[currentTone].texts[currentLength] = e.target.value;
});

document.querySelectorAll('.tone-checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', (e) => e.stopPropagation()); 
    checkbox.addEventListener('change', (e) => {
        const tone = e.target.closest('.tone-bar').dataset.tone;
        itemData[tone].enabled = e.target.checked;
        if(tone === currentTone) aggiornaEditorTesto();
    });
});

document.querySelectorAll('.tone-bar').forEach(bar => {
    bar.addEventListener('click', (e) => {
        document.querySelectorAll('.tone-bar').forEach(b => b.classList.remove('active'));
        bar.classList.add('active');
        currentTone = bar.dataset.tone;
        aggiornaEditorTesto();
    });
});

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
            alert("Testi aggiornati e salvati con successo!");
            tornaAllaVisita(); 
        } else {
            alert("Errore nel salvataggio dell'opera sul database.");
        }
    } catch (error) {
        console.error(error);
    }
});