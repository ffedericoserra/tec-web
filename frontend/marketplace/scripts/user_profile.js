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

function entityId(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value._id || value.id || "";
}

function visitMuseum(visit) {
    return typeof visit.museumId === "object" && visit.museumId !== null
        ? visit.museumId
        : { _id: visit.museumId };
}

function accountVisitUrl(visit, isFavorite) {
    const museum = visitMuseum(visit);
    if (isFavorite && museum.slug && visit.slug) {
        return `/${encodeURIComponent(museum.slug)}/${encodeURIComponent(visit.slug)}`;
    }

    const params = new URLSearchParams();
    const museumId = entityId(museum);
    if (museumId) params.set("museumId", museumId);
    if (museum.name) params.set("museumName", museum.name);
    return `visits_list.html${params.toString() ? `?${params.toString()}` : ""}`;
}

function renderVisitCollection(containerId, visits, isFavorite = false) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    if (!visits.length) {
        const empty = document.createElement("p");
        empty.classList.add("account-empty");
        empty.textContent = isFavorite
            ? "Non hai ancora salvato visite nei preferiti."
            : "Non hai ancora creato visite.";
        container.appendChild(empty);
        return;
    }

    visits.forEach((visit) => {
        const museum = visitMuseum(visit);
        const row = document.createElement("article");
        row.classList.add("account-list-item");

        const copy = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = visit.title || "Visita senza titolo";
        const meta = document.createElement("span");
        meta.textContent = museum.name || (isFavorite ? "Visita salvata" : "Visita creata");
        copy.append(title, meta);

        const link = document.createElement("a");
        link.href = accountVisitUrl(visit, isFavorite);
        link.textContent = isFavorite ? "Apri" : "Gestisci";
        row.append(copy, link);
        container.appendChild(row);
    });
}

async function loadAccount() {
    try {
        const data = await api("/auth/me");
        user = data.user || data;
        document.getElementById("profile-username").textContent = user.username || "Utente";
        document.getElementById("profile-email").textContent = user.email || "Email non disponibile";
        document.getElementById("profile-avatar").src = user.avatarUrl || "/uploads/profiles/default-avatar.jpeg";
        document.getElementById("wallet-balance").textContent = formatBalance(user.walletBalance);
        renderVisitCollection("account-visits", user.myVisits || []);
        renderVisitCollection("account-favorites", user.savedVisits || [], true);
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
