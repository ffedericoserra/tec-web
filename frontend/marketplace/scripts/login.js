const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;

var form=document.getElementById("login-form")
form.addEventListener("submit", async (x)=>{
    x.preventDefault();

    const user=document.getElementsByName("username")[0].value
    const pwd=document.getElementsByName("pwd")[0].value
    const errMsg=document.getElementById("error-msg")
    
    errMsg.innerHTML="<p></p>"

    try{
        const res=await fetch(`${myApi}/auth/login`, {//L'uriref in deploy viene completato da solo, in deploy sarebbe https://site242557.tw.cs.unibo.it/api/auth/login altrimenti in locale 
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                username: user,
                password: pwd
            })
        })

        const data=await res.json()
        if(res.ok){
            localStorage.setItem("token", data.token)
            localStorage.setItem("user", JSON.stringify(data.user))
            window.location.href="../pages/homepage.html"
        }
        else{
            errMsg.innerHTML=`<p>${data.error || "Login failed"}</p>`
        }

    }
    catch(err){
        console.log("Errore durante il login: "+err)
        errMsg.innerHTML="<p>Server error</p>"
    }



})

function typeWriterEffect(inputElement, text, speed) {
    let i = 0;
    inputElement.placeholder = ""; // Svuota il placeholder iniziale
    
    function type() {
        if (i < text.length) {
            inputElement.placeholder += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    // Avvia l'animazione con un leggero ritardo
    setTimeout(type, 500); 
}

// Quando la pagina carica, avviamo l'effetto
document.addEventListener('DOMContentLoaded', () => {
    const userField = document.querySelector('input[name="username"]');
    if(userField) {
        typeWriterEffect(userField, "Inserisci username o email...", 100);
    }
});