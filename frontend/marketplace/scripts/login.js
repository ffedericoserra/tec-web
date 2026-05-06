const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;

const form = document.getElementById("login-form");
const errMsg = document.getElementById("error-msg");

function setLoginError(message = "") {
    errMsg.textContent = message;
    errMsg.classList.toggle("is-visible", Boolean(message));
}

if (form) {
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const user = document.getElementsByName("username")[0].value.trim();
        const pwd = document.getElementsByName("pwd")[0].value;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        setLoginError();
        submitBtn.textContent = "Accesso...";
        submitBtn.classList.add("is-loading");
        submitBtn.disabled = true;

        try {
            const res = await fetch(`${myApi}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: user,
                    password: pwd
                })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));
                window.location.href = "../pages/homepage.html";
            } else {
                setLoginError(data.error || "Login failed");
            }
        } catch (err) {
            console.log("Errore durante il login: " + err);
            setLoginError("Server error");
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.classList.remove("is-loading");
            submitBtn.disabled = false;
        }
    });
}

function typeWriterEffect(inputElement, text, speed) {
    let i = 0;
    inputElement.placeholder = "";

    function type() {
        if (i < text.length) {
            inputElement.placeholder += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }

    setTimeout(type, 500);
}

document.addEventListener('DOMContentLoaded', () => {
    const userField = document.querySelector('input[name="username"]');

    if (userField) {
        typeWriterEffect(userField, "Inserisci username o email...", 100);
    }
});
