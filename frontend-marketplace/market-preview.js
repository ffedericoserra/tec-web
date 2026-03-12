const myApi="http://localhost:8000/api" //da cambiare in fase di deploy???
const museumList=document.getElementById("museum-list")
const token=localStorage.getItem("token");
const addBtn=document.getElementsByClassName("add-btn")

if(!token){
    alert("You must be logged in to access this page.")
    window.location.href="loginpage.html"
}

museumList.innerHTML=""

async function loadMuseumsList(){
    try{
        const res=await fetch(`${myApi}/museums`)
        const data=await res.json()
        const allMuseums=data.museums || []
        
        //mostriamo i musei
        allMuseums.forEach(m => {
            var newIcon=document.createElement("div")
            newIcon.className="museum-icon"
            newIcon.innerHTML=`
                <h3>${m.name}</h3>
                <p>${m.address}</p>
                
            ` //l'imageURL come lo gestiamo? <img src=${m.imageUrl}></img> 
            museumList.appendChild(newIcon)
        });
    }
    catch(er){
        console.error("Error while loading the museums" + er)
    }

    try{
        Array.from(document.getElementsByClassName("museum-icon")).forEach((elem)=>{
            elem.onclick=()=>alert("prova")//~~~~~~~~~~~~~~~~~~~~~~
            //TODO: al click mostrare due opzioni: 1.visualizza visite esistenti(con l'opzione poi di modificarle) o 2. crea nuova visita da zero 
        })
    }
    catch(er){
        console.error("errore nel clicking dei musei" + er)
    }


}




addBtn.onclick=function(){ //addNewMuseumToTheList
    //TO DO
}
loadMuseumsList()

