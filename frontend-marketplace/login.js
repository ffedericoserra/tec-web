var form=document.getElementById("login-form")
form.addEventListener("submit", async (x)=>{
    x.preventDefault();

    const user=document.getElementsByName("username")
    const pwd=document.getElementsByName("pwd")
    const errMsg=document.getElementById("error-msg")
    
    errMsg.innerHTML="<p></p>"

    try{
        const res=await fetch("http://localhost:8000/api/auth/login", {//Da aggiotrnare URI in fase di deploy test su macchine unibo
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
            localStorage.setitem("user", JSON.stringify(data.user))
            window.location.href="editorpage.html"
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