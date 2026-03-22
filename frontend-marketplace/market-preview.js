const myApi = "http://localhost:8000/api" // da cambiare in fase di deploy
const museumList = document.getElementById("museum-list")
const token = localStorage.getItem("token")
const addBtn = document.querySelector(".add-btn")

if (!token) {
    alert("You must be logged in to access this page.")
    window.location.href = "loginpage.html"
}

async function loadMuseumsList() {
    try {
        const res = await fetch(`${myApi}/museums`)
        const data = await res.json()
        const allMuseums = data.museums || []
        
        museumList.innerHTML = ""
        
        //mostriamo i musei
        allMuseums.forEach(m => {
            const newIcon = document.createElement("div")
            newIcon.className = "museum-icon"
            newIcon.innerHTML = `
                <h3>${m.name}</h3>
                <p>${m.address || 'Address not available'}</p>
            ` 
            
            newIcon.onclick = () => {
                alert("prova")
                // TODO: al click mostrare due opzioni: 1.visualizza visite esistenti(con l'opzione poi di modificarle) o 2. crea nuova visita da zero 
            }
            
            museumList.appendChild(newIcon)
        })
    } catch(er) {
        console.error("Error while loading the museums " + er)
    }
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
loadMuseumsList()