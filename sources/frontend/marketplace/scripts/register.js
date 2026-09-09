const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;

const registerForm = document.getElementById("register-form");
const errorMsg = document.getElementById("error-msg");

function setupPasswordVisibilityToggle() {
    const toggle = document.querySelector("[data-password-visibility-toggle]");
    const passwordInput = document.getElementById("reg-pwd");
    if (!toggle || !passwordInput) return;

    toggle.addEventListener("click", () => {
        const isVisible = passwordInput.type === "text";
        passwordInput.type = isVisible ? "password" : "text";
        toggle.querySelector("img").src = isVisible
            ? "../assets/artaround/closed-eye-icon.png"
            : "../assets/artaround/open-eye-icon.png";
        const labelKey = isVisible ? "common.showPassword" : "common.hidePassword";
        toggle.setAttribute("data-i18n-aria-label", labelKey);
        toggle.setAttribute("aria-label", marketplaceT(labelKey));
        toggle.setAttribute("aria-pressed", String(!isVisible));
    });
}

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

        setRegisterMessage(marketplaceT("register.creating"), "info");
        submitBtn.textContent = marketplaceT("register.submitting");
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
                const language = window.marketplaceI18n.getLanguage();
                if (data.user?.language !== language) {
                    try {
                        const languageResponse = await fetch(`${myApi}/auth/language`, {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${data.token}`
                            },
                            body: JSON.stringify({ language })
                        });
                        if (!languageResponse.ok) {
                            await window.marketplaceI18n.changeLanguage(data.user?.language || "it");
                        }
                    } catch (error) {
                        await window.marketplaceI18n.changeLanguage(data.user?.language || "it");
                    }
                }
                window.location.href = "../pages/homepage.html";
            } else {
                const errorKey = res.status === 409
                    ? "register.alreadyExists"
                    : res.status === 400
                        ? "register.invalidFields"
                        : "register.failed";
                setRegisterMessage(marketplaceT(errorKey), "error");
            }
        } catch (err) {
            setRegisterMessage(marketplaceT("register.connectionError"), "error");
            console.error("Register fetch error: ", err);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.classList.remove("is-loading");
            submitBtn.disabled = false;
        }
    });
}

document.addEventListener("DOMContentLoaded", setupPasswordVisibilityToggle);
