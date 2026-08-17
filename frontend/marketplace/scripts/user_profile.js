const isLocal = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1");
const baseUrl = isLocal ? "http://localhost:8000" : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token") || localStorage.getItem("artaround_token");
let user = null;

if (!token) window.location.replace("login.html");

async function api(path, options = {}) {
    const response = await fetch(`${myApi}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type":"application/json" } : {}),
            "Authorization":`Bearer ${token}`,
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Richiesta non riuscita");
    return data;
}

function formatBalance(value) {
    const number = Number(value) || 0;
    return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

async function loadAccount() {
    try {
        const data = await api("/auth/me");
        user = data.user || data;
        document.getElementById("profile-username").textContent = user.username || "Utente";
        document.getElementById("profile-email").textContent = user.email || "Email non disponibile";
        document.getElementById("profile-avatar").src = user.avatarUrl || "/uploads/profiles/default-avatar.jpeg";
        document.getElementById("wallet-balance").textContent = formatBalance(user.walletBalance);
    } catch (error) {
        document.getElementById("account-feedback").textContent = error.message;
    }
}

document.getElementById("wallet-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const amount = Number(document.getElementById("wallet-amount").value);
    const feedback = document.getElementById("account-feedback");
    if (!Number.isFinite(amount) || amount <= 0) {
        feedback.textContent = "Inserisci un importo valido.";
        return;
    }
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
        const data = await api("/auth/wallet", { method:"PATCH", body:JSON.stringify({ amount }) });
        document.getElementById("wallet-balance").textContent = formatBalance(data.walletBalance ?? data.user?.walletBalance);
        feedback.textContent = `Ricarica di ${formatBalance(amount)} Aα completata.`;
    } catch (error) {
        feedback.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

loadAccount();
