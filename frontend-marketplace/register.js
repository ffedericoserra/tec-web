const myApi = "http://localhost:8000/api"
const registerForm = document.getElementById("login-form")
const errorMsg = document.getElementById("error-msg")

if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault()
        errorMsg.innerHTML = "Creating account..."
        errorMsg.style.color = "#000"

        const usernameVal = document.getElementById("reg-username").value
        const emailVal = document.getElementById("reg-email").value
        const passwordVal = document.getElementById("reg-pwd").value

        try {
            const res = await fetch(`${myApi}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: usernameVal,
                    email: emailVal,
                    password: passwordVal
                })
            })

            const data = await res.json()

            if (res.ok) {
                // Salviamo il token
                localStorage.setItem("token", data.token)
                // Rimandiamo l'utente alla homepage o al marketplace
                window.location.href = "MUSEUM-PREVIEW.html"
            } else {
                errorMsg.innerHTML = data.error || "Registration failed"
                errorMsg.style.color = "#A93226"
            }
        } catch (err) {
            errorMsg.innerHTML = "Server connection error"
            errorMsg.style.color = "#A93226"
            console.error("Register fetch error: " + err)
        }
    })
}