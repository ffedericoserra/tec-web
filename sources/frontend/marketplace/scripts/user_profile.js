const isLocal = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1");
const baseUrl = isLocal ? "http://localhost:8000" : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token") || localStorage.getItem("artaround_token");
let user = null;

document.getElementById("profile-username").textContent = marketplaceT("account.loading");

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
    if (!response.ok) throw new Error(data.error || marketplaceT("errors.requestFailed"));
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

function navigatorVisitUrl(visit) {
    const museum = visitMuseum(visit);
    if (museum.slug && visit.slug) {
        return `/${encodeURIComponent(museum.slug)}/${encodeURIComponent(visit.slug)}`;
    }
    return "";
}

function accountVisitUrl(visit) {
    const navigatorUrl = navigatorVisitUrl(visit);
    if (navigatorUrl) return navigatorUrl;

    const museum = visitMuseum(visit);
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
            ? marketplaceT("account.noFavorites")
            : marketplaceT("account.noVisits");
        container.appendChild(empty);
        return;
    }

    visits.forEach((visit) => {
        const museum = visitMuseum(visit);
        const row = document.createElement("article");
        row.classList.add("account-list-item");

        const copy = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = visit.title || marketplaceT("account.untitledVisit");
        const meta = document.createElement("span");
        meta.textContent = museum.name || (isFavorite
            ? marketplaceT("account.savedVisit")
            : marketplaceT("account.createdVisit"));
        copy.append(title, meta);

        const link = document.createElement("a");
        const canOpenInNavigator = Boolean(navigatorVisitUrl(visit));
        link.href = accountVisitUrl(visit);
        link.textContent = canOpenInNavigator
            ? marketplaceT("account.open")
            : marketplaceT("account.manage");
        const actions = document.createElement("div");
        actions.classList.add("account-list-actions");
        if (isFavorite) {
            const favoriteButton = document.createElement("button");
            favoriteButton.classList.add("account-favorite-btn");
            favoriteButton.type = "button";
            favoriteButton.setAttribute("aria-label", marketplaceT("account.removeFavorite"));
            favoriteButton.title = marketplaceT("account.removeFavorite");
            favoriteButton.innerHTML = '<span aria-hidden="true">★</span>';
            favoriteButton.addEventListener("click", () => removeFavoriteVisit(visit, favoriteButton));
            actions.appendChild(favoriteButton);
        }
        actions.appendChild(link);
        row.append(copy, actions);
        container.appendChild(row);
    });
}

async function removeFavoriteVisit(visit, button) {
    if (!user) return;
    const visitId = entityId(visit);
    if (!visitId) return;
    button.disabled = true;
    try {
        await api(`/auth/favorites/visits/${encodeURIComponent(visitId)}`, { method: "POST" });
        user.savedVisits = (user.savedVisits || []).filter((savedVisit) => entityId(savedVisit) !== visitId);
        renderVisitCollection("account-favorites", user.savedVisits || [], true);
        document.getElementById("account-feedback").textContent = marketplaceT("account.favoriteRemoved");
    } catch (error) {
        document.getElementById("account-feedback").textContent = marketplaceT("account.favoriteRemoveError");
        button.disabled = false;
    }
}

async function loadAccount() {
    try {
        const data = await api("/auth/me");
        user = data.user || data;
        if (window.marketplaceI18n.SUPPORTED_LANGUAGES.includes(user.language)) {
            await window.marketplaceI18n.changeLanguage(user.language);
        }
        document.getElementById("profile-username").textContent = user.username || marketplaceT("account.user");
        document.getElementById("profile-email").textContent = user.email || marketplaceT("account.emailUnavailable");
        document.getElementById("profile-avatar").src = user.avatarUrl || "/uploads/profiles/default-avatar.jpeg";
        document.getElementById("wallet-balance").textContent = formatBalance(user.walletBalance);
        renderVisitCollection("account-visits", user.myVisits || []);
        renderVisitCollection("account-favorites", user.savedVisits || [], true);
        updateLanguageButtons();
        document.querySelectorAll(".language-btn").forEach((button) => {
            button.disabled = false;
        });
    } catch (error) {
        document.getElementById("account-feedback").textContent = marketplaceT("account.loadError");
    }
}

function updateLanguageButtons() {
    const currentLanguage = window.marketplaceI18n.getLanguage();
    document.querySelectorAll(".language-btn").forEach((button) => {
        const isActive = button.dataset.language === currentLanguage;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

async function saveAccountLanguage(language) {
    if (!user) return;
    const feedback = document.getElementById("language-feedback");
    const buttons = document.querySelectorAll(".language-btn");
    const previousLanguage = window.marketplaceI18n.getLanguage();
    buttons.forEach((button) => { button.disabled = true; });
    feedback.textContent = "";

    await window.marketplaceI18n.changeLanguage(language);
    updateLanguageButtons();

    try {
        const data = await api("/auth/language", {
            method: "PATCH",
            body: JSON.stringify({ language })
        });
        user = {
            ...user,
            language: data.user?.language || data.language || language
        };
        feedback.textContent = marketplaceT("account.languageSaved");
    } catch (error) {
        await window.marketplaceI18n.changeLanguage(previousLanguage);
        feedback.textContent = marketplaceT("account.languageSaveError");
    } finally {
        buttons.forEach((button) => { button.disabled = false; });
    }
}

document.getElementById("wallet-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const amount = Number(document.getElementById("wallet-amount").value);
    const feedback = document.getElementById("account-feedback");
    if (!Number.isFinite(amount) || amount <= 0) {
        feedback.textContent = marketplaceT("account.invalidAmount");
        return;
    }
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
        const data = await api("/auth/wallet", { method:"PATCH", body:JSON.stringify({ amount }) });
        document.getElementById("wallet-balance").textContent = formatBalance(data.walletBalance ?? data.user?.walletBalance);
        feedback.textContent = marketplaceT("account.rechargeSuccess", {
            amount: formatBalance(amount)
        });
    } catch (error) {
        feedback.textContent = marketplaceT("account.rechargeError");
    } finally {
        button.disabled = false;
    }
});

document.querySelectorAll(".language-btn").forEach((button) => {
    button.addEventListener("click", () => saveAccountLanguage(button.dataset.language));
});

window.addEventListener("marketplace:language-changed", () => {
    updateLanguageButtons();
    document.getElementById("profile-username").textContent = user?.username
        || marketplaceT(user ? "account.user" : "account.loading");
    document.getElementById("profile-email").textContent = user?.email
        || (user ? marketplaceT("account.emailUnavailable") : "—");
    if (!user) return;
    renderVisitCollection("account-visits", user.myVisits || []);
    renderVisitCollection("account-favorites", user.savedVisits || [], true);
});

updateLanguageButtons();
loadAccount();
