const myApi = "http://localhost:8000/api"
const token = localStorage.getItem("token")
const visitsContainer = document.getElementById("museum-list")

// query specifiche del museo selezionati
const urlParams = new URLSearchParams(window.location.search);
const currMuseumId = urlParams.get('museumId');
const currMuseumName = urlParams.get('museumName');

console.log("Stiamo lavorando sul museo:", currMuseumName, "con ID:", currMuseumId);



function setUpMuseumDatas(){
    var titolo=document.querySelector(".title")
    if(titolo && currMuseumName) titolo.innerHTML=currMuseumName
}

async function loadList(){
    if(!currMuseumId){
        visitsContainer.innerHTML="<p style='color: red;'>Errore: ID museo mancante.</p>"
        return;
    }
    try{
        const res=await fetch(`${myApi}/visits/my?museumId=${currMuseumId}`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })

        var data=await res.json()
        var visitsArr=data.visits || []

        visitsContainer.innerHTML=""

        if(visitsArr.length===0){
            visitsContainer.innerHTML=`
                <div style="grid-column: 1 / -1; padding: 40px;">
                    <p style="color: #666; font-style: italic;">No visits available for this museum yet. Create the first one!</p>
                </div>
            `

            return;
        }
        else{
            visitsArr.forEach(v =>{
                var visitIcon=document.createElement("div")
                visitIcon.className="visit-icon"

                visitIcon.style.display="flex"
                visitIcon.style.flexDirection="column"
                visitIcon.style.justifyContent="space-between"


                visitIcon.innerHTML=`
                    <div style="border: 1px solid var(--border-light); border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #FAFAFA; flex-grow: 1;">
                        <h3 style="color: var(--charcoal); margin-top: 0; margin-bottom: 10px; font-size: 1.3rem;">${v.title}</h3>
                        <p style="color: #666; font-size: 0.95rem; line-height: 1.4; margin: 0;">${v.description || 'No description provided.'}</p>
                    </div>

                    <div style="display: flex; gap: 10px; width: 100%;">
                        <button class="start-btn" style="flex: 1; background-color: var(--museum-gold); color: white; border: none; border-radius: 4px; padding: 12px 0; font-weight: 700; cursor: pointer; text-transform: uppercase; font-size: 0.85rem;">
                            Start Tour &rarr;
                        </button>
                        <button class="edit-btn" style="flex: 1; background-color: var(--charcoal); color: white; border: none; border-radius: 4px; padding: 12px 0; font-weight: 700; cursor: pointer; text-transform: uppercase; font-size: 0.85rem;">
                            Edit Tour &rarr;
                        </button>
                    </div>
                `

                var editBtn=visitIcon.querySelector(".edit-btn")
                var startBtn=visitIcon.querySelector(".start-btn")

                startBtn.onclick= (e) => {
                    e.stopPropagation()
                    window.location.href=`navigator.html?museumId=${currMuseumId}&visitId=${v._id}`
                }
                editBtn.onclick= (e) => {
                    e.stopPropagation()
                    window.location.href=`editor.html?museumId=${currMuseumId}&visitId=${v._id}`
                }

                visitsContainer.appendChild(visitIcon)
            })
        }
    }catch(err){
        console.error("Errore durante il caricamento delle visite: " + err)
        visitsContainer.innerHTML = "<p style='color: #A93226; grid-column: 1 / -1;'>Server error while loading visits.</p>"
    }

}

setUpMuseumDatas()
loadList()

const addNewVisitBtn = document.getElementById("add-visit-btn"); 

if (addNewVisitBtn) {
    addNewVisitBtn.addEventListener('click', () => {
        window.location.href = `create_visits.html?museumId=${currMuseumId}&museumName=${encodeURIComponent(currMuseumName)}`;
    });
}