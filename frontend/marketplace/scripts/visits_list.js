const isLocal = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1");
const baseUrl = isLocal ? "http://localhost:8000" : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token") || localStorage.getItem("artaround_token");

const museumSelect = document.getElementById("museum-select");
const visitsContainer = document.getElementById("tours-list");
const feedback = document.getElementById("visits-feedback");
const addButton = document.getElementById("add-visit-btn");
let museums = [];
let selectedMuseum = null;
let pendingDelete = null;

if (!token) window.location.replace("login.html");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

async function api(path, options = {}) {
    const response = await fetch(`${myApi}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Richiesta non riuscita");
    return data;
}

function visitEditorUrl(visitId = "") {
    const params = new URLSearchParams({
        museumId: selectedMuseum._id,
        museumName: selectedMuseum.name
    });
    if (visitId) params.set("visitId", visitId);
    return `create_visits.html?${params.toString()}`;
}

function renderVisits(visits) {
    visitsContainer.innerHTML = "";
    if (visits.length === 0) {
        visitsContainer.innerHTML = `<div class="empty-state"><h2>Nessuna visita</h2><p>Crea il primo percorso per ${escapeHTML(selectedMuseum.name)}.</p></div>`;
        return;
    }

    visits.forEach((visit) => {
        const card = document.createElement("article");
        card.className = "visit-card";
        card.innerHTML = `
            <div>
                <span class="visit-label">${visit.type === "synchronized" ? "Visita di gruppo" : "Visita standard"}</span>
                <h2>${escapeHTML(visit.title || "Visita senza titolo")}</h2>
                <p>${escapeHTML(visit.description || "Nessuna introduzione")}</p>
            </div>
            <div class="visit-meta">
                <span>${visit.sequence?.length || 0} contenuti</span>
                <span>${visit.isPublic ? "Pubblica" : "Privata"}</span>
            </div>
            <div class="visit-actions">
                <a class="secondary-btn" href="${visitEditorUrl(visit._id)}">Modifica</a>
                <button class="delete-btn" type="button">Elimina</button>
            </div>
        `;
        card.querySelector(".delete-btn").addEventListener("click", () => openDeleteModal(visit));
        visitsContainer.appendChild(card);
    });
}

async function loadVisits() {
    if (!selectedMuseum) return;
    feedback.textContent = "Caricamento visite...";
    visitsContainer.innerHTML = "";
    try {
        const data = await api(`/visits/my?museumId=${encodeURIComponent(selectedMuseum._id)}`);
        renderVisits(data.visits || []);
        feedback.textContent = "";
    } catch (error) {
        feedback.textContent = error.message;
        feedback.classList.add("is-error");
    }
}

function selectMuseum(id) {
    selectedMuseum = museums.find((museum) => museum._id === id) || null;
    addButton.disabled = !selectedMuseum;
    if (selectedMuseum) {
        localStorage.setItem("marketplace_v2_museum", selectedMuseum._id);
        loadVisits();
    } else {
        visitsContainer.innerHTML = `<div class="empty-state"><h2>Scegli un museo</h2><p>Le tue visite verranno filtrate per museo.</p></div>`;
    }
}

async function loadMuseums() {
    try {
        const data = await api("/museums");
        museums = data.museums || data || [];
        museumSelect.innerHTML = `<option value="">Seleziona un museo</option>` + museums
            .map((museum) => `<option value="${museum._id}">${escapeHTML(museum.name)}</option>`).join("");
        const requested = new URLSearchParams(window.location.search).get("museumId");
        const saved = localStorage.getItem("marketplace_v2_museum");
        const initial = museums.some((museum) => museum._id === requested) ? requested
            : museums.some((museum) => museum._id === saved) ? saved : "";
        museumSelect.value = initial;
        selectMuseum(initial);
    } catch (error) {
        museumSelect.innerHTML = `<option value="">Musei non disponibili</option>`;
        feedback.textContent = error.message;
        feedback.classList.add("is-error");
    }
}

function openDeleteModal(visit) {
    pendingDelete = visit;
    document.getElementById("delete-modal-text").textContent = `“${visit.title}” verrà eliminata definitivamente.`;
    document.getElementById("delete-confirm-modal").classList.remove("hidden");
}

document.getElementById("cancel-delete-btn").addEventListener("click", () => {
    pendingDelete = null;
    document.getElementById("delete-confirm-modal").classList.add("hidden");
});

document.getElementById("confirm-delete-btn").addEventListener("click", async () => {
    if (!pendingDelete) return;
    const button = document.getElementById("confirm-delete-btn");
    button.disabled = true;
    try {
        await api(`/visits/${pendingDelete._id}`, { method: "DELETE" });
        document.getElementById("delete-confirm-modal").classList.add("hidden");
        pendingDelete = null;
        await loadVisits();
    } catch (error) {
        alert(error.message);
    } finally {
        button.disabled = false;
    }
});

museumSelect.addEventListener("change", () => selectMuseum(museumSelect.value));
addButton.addEventListener("click", () => {
    if (selectedMuseum) window.location.href = visitEditorUrl();
});
loadMuseums();
