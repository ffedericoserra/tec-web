const myApi = "http://localhost:8000/api" // da cambiare in fase di deploy
const museumList = document.getElementById("museum-list")
const token = localStorage.getItem("token")
const addBtn = document.querySelector(".add-btn")
const searchBar=document.querySelector("#search-bar")

let allMuseums=[]

if (!token) {
    alert("You must be logged in to access this page.")
    window.location.href = "loginpage.html"
}

function showMuseumOptions(museumId, museumName){
    var overlay=document.createElement("div")
    overlay.className="modal-overlay"
    overlay.id="visit-choice-modal"

    var modalContent=document.createElement("div")
    modalContent.className="modal-content auth-form"
    modalContent.style.textAlign="center"

    modalContent.innerHTML = `
        <h3 style="color: var(--charcoal); font-family: 'Playfair Display', serif; margin: 0;">${museumName}</h3>
        <p style="color: #666; margin-bottom: 25px; margin-top: 5px;">What would you like to do?</p>
        
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <button class="main-btn" id="view-visits-btn">View Existing Visits</button>
            <button class="main-btn" id="create-visit-btn" style="background: var(--charcoal); color: white;">Create New Visit</button>
            <button id="cancel-choice-btn" style="background: transparent; border: none; color: #999; font-size: 0.9rem; margin-top: 10px; cursor: pointer; text-decoration: underline;">Cancel</button>
        </div>
    `

    overlay.appendChild(modalContent)
    document.body.appendChild(overlay)

    //cosa fanno i bottoni: 1. => visualizza visite esisteni; 2. => crea nuova visita

    var option1=document.getElementById("view-visits-btn")
    var option2=document.getElementById("create-visit-btn")

    option1.onclick= () => {
        //manda a pag HTML inviandogli l'ID museo
        window.location.href=`visits-list.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`;
    }
    option2.onclick= () => {
        window.location.href=`create_visits.html?museumId=${museumId}&museumName=${encodeURIComponent(museumName)}`
    }
    
    document.getElementById("cancel-choice-btn").onclick = () => {
        document.body.removeChild(overlay)
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

function renderMuseumsList(museumArr) {
    museumList.innerHTML = ""
    if(museumArr.length===0){
        museumList.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: var(--chill-grey); font-size: 1.1rem;">Nessun museo trovato.</p>`
        return;
    }

    //mostriamo i musei
    museumArr.forEach(m => {
        const newIcon = document.createElement("div")
        newIcon.className = "museum-icon"
        newIcon.innerHTML = `
            <h3>${m.name}</h3>
            <p>${m.address || 'Address not available'}</p>
        ` 
            
        newIcon.onclick = () => {
            showMuseumOptions(m._id, m.name)    
        }
        
        museumList.appendChild(newIcon)
            
    })
    
}

async function loadMuseumsList() {
    try {
        const res = await fetch(`${myApi}/museums`)
        const data = await res.json()
        allMuseums = data.museums || []

        renderMuseumsList(allMuseums)
        
      
    } catch(er) {
        console.error("Error while loading the museums " + er)
        erMessage=document.createElement("div")
        erMessage.innerHTML="<p id='error-msg'>The server could not load the museum list. Please try again later.</p>"
        
        museumList.append(erMessage)
        
    }
}

function setupSearchListeners() {
    if(!searchBar) return;
    searchBar.addEventListener("input", (e)=>{
        var searchTerm = e.target.value.toLowerCase().trim();
        var filteredArr=allMuseums.filter(mus=>{
            var matchingName=mus.name &&  mus.name.toLowerCase().includes(searchTerm)
            matchingAddr=mus.address && mus.address.toLowerCase().includes(searchTerm)

            return matchingName || matchingAddr
        })

        renderMuseumsList(filteredArr)
    })
}

function setupModalListeners() {
    try {
        const modal = document.getElementById('add-museum-modal')
        const form = document.getElementById('add-museum-form')
        const cancelBtn = document.getElementById('cancel-add-btn')
        const errorMsg = document.getElementById('add-modal-error') 

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                modal.classList.remove("hidden")
                errorMsg.innerHTML = ""
            })
        }

        const closeModal = () => {
            modal.classList.add("hidden")
            form.reset()
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener("click", closeModal)
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });
        }

        if (form) {
            form.addEventListener("submit", async (e) => {
                e.preventDefault()
                errorMsg.innerHTML = "Saving..."
                errorMsg.style.color = "#000"

                const payload = {
                    name: document.getElementById('m-name').value,
                    address: document.getElementById('m-address').value,
                    description: document.getElementById('m-description').value,
                    //imageUrl: document.getElementById('m-image').value
                }

                try {
                    const res = await fetch(`${myApi}/museums`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}` 
                        },
                        body: JSON.stringify(payload)
                    })

                    const data = await res.json()

                    if (res.ok) {
                        closeModal()
                        loadMuseumsList() 
                    } else {
                        errorMsg.innerHTML = data.error || 'Failed to add museum'
                        errorMsg.style.color = '#d9534f'
                    }
                } catch(fetchErr) {
                    errorMsg.innerHTML = 'Server error'
                    errorMsg.style.color = '#d9534f'
                    console.error("Errore fetch: " + fetchErr)
                }
            })
        }
    } catch(er) {
        console.error("Errore nell'impostazione della modale: " + er)
    }
}

// Avviamo tutto
setupModalListeners()
setupSearchListeners()
loadMuseumsList()