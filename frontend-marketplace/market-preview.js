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
                <img src=${m.imageUrl}></img> 
            ` //l'imageURL come lo gestiamo?
            museumList.appendChild(newIcon)
        });
    }
    catch(er){
        console.error("Error while loading the museums" + er)
    }
}












addBtn.onclick=function(){ //addNewMuseumToTheList
    //TO DO
}
loadMuseumsList()