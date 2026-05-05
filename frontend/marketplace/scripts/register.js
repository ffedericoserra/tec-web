const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;

const registerForm = document.getElementById("register-form");
const errorMsg = document.getElementById("error-msg");

function setRegisterMessage(message = "", type = "error") {
    errorMsg.textContent = message;
    errorMsg.classList.toggle("is-visible", Boolean(message));
    errorMsg.classList.toggle("is-error", type === "error" && Boolean(message));
    errorMsg.classList.toggle("is-info", type === "info" && Boolean(message));
}

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const submitBtn = registerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        setRegisterMessage("Creating account...", "info");
        submitBtn.textContent = "Creazione...";
        submitBtn.classList.add("is-loading");
        submitBtn.disabled = true;

        const payload = {
            username: document.getElementById("reg-username").value.trim(),
            email: document.getElementById("reg-email").value.trim(),
            password: document.getElementById("reg-pwd").value
        };

        try {
            const res = await fetch(`${myApi}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem("token", data.token);
                window.location.href = "../pages/homepage.html";
            } else {
                setRegisterMessage(data.error || "Registration failed", "error");
            }
        } catch (err) {
            setRegisterMessage("Server connection error", "error");
            console.error("Register fetch error: ", err);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.classList.remove("is-loading");
            submitBtn.disabled = false;
        }
    });
}
