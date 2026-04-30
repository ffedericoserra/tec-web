const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;

const registerForm = document.getElementById("login-form")
const errorMsg = document.getElementById("error-msg")

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        // Blocca il ricaricamento della pagina
        e.preventDefault()
        
        errorMsg.innerHTML = "Creating account..."
        errorMsg.style.color = "#000"

        // Legge i valori usando gli ID corretti impostati nel file registerpage.html
        const usernameVal = document.getElementById("reg-username").value
        const emailVal = document.getElementById("reg-email").value
        const passwordVal = document.getElementById("reg-pwd").value

        // Oggetto payload da inviare
        const payload = {
            username: usernameVal,
            email: emailVal,
            password: passwordVal
        };

        // Stampa i dati nella console del browser (F12) per verificare che non siano vuoti
        //console.log("Dati in invio al backend:", payload);

        try {
            const res = await fetch(`${myApi}/auth/register`, {
                method: "POST",
                headers: {
                    // Questo header è FONDAMENTALE, senza di esso Express non legge il req.body
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })

            const data = await res.json()

            if (res.ok) {
                // Salviamo il token
                localStorage.setItem("token", data.token)
                // Rimandiamo l'utente al marketplace
                window.location.href = "museum-preview.html"
            } else {
                errorMsg.innerHTML = data.error || "Registration failed"
                errorMsg.style.color = "#A93226"
            }
        } catch (err) {
            errorMsg.innerHTML = "Server connection error"
            errorMsg.style.color = "#A93226"
            console.error("Register fetch error: ", err)
        }
    })
}