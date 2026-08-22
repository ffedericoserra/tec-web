const isLocal = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1");
const baseUrl = isLocal ? "http://localhost:8000" : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token") || localStorage.getItem("artaround_token");

const museumSelect = document.getElementById("museum-select");
const visitsContainer = document.getElementById("tours-list");
const feedback = document.getElementById("visits-feedback");
const addButton = document.getElementById("add-visit-btn");
const visitSearch = document.getElementById("visit-search");
let museums = [];
let visits = [];
let selectedMuseum = null;
let pendingDelete = null;
let museumLoadFailed = false;
let currentUserId = "";

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
    if (!response.ok) throw new Error(data.error || marketplaceT("errors.requestFailed"));
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

function entityId(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value._id || value.id || "";
}

function isOwnVisit(visit) {
    return entityId(visit.creatorId) === currentUserId;
}

function filteredVisits(collection) {
    const term = visitSearch.value.trim().toLowerCase();
    if (!term) return collection;
    return collection.filter((visit) =>
        `${visit.title || ""} ${visit.description || ""} ${visit.type || ""} ${visit.creatorId?.username || ""}`
            .toLowerCase()
            .includes(term)
    );
}

function visitRunUrl(visit) {
    const museumRef = selectedMuseum.slug || selectedMuseum._id;
    const visitRef = visit.slug || visit._id;
    return `/${encodeURIComponent(museumRef)}/${encodeURIComponent(visitRef)}`;
}

function renderMuseumOptions() {
    const selectedMuseumId = museumSelect.value;
    if (museumLoadFailed) {
        museumSelect.innerHTML = `<option value="">${marketplaceT("visits.unavailableMuseums")}</option>`;
        return;
    }
    museumSelect.innerHTML = `<option value="">${marketplaceT("visits.selectMuseum")}</option>` + museums
        .map((museum) => `<option value="${museum._id}">${escapeHTML(museum.name)}</option>`).join("");
    museumSelect.value = selectedMuseumId;
}

function renderVisits() {
    visitsContainer.innerHTML = "";
    if (!selectedMuseum) {
        const message = marketplaceT("visits.chooseMuseumSearch");
        visitsContainer.innerHTML = `<div class="empty-state"><h2>${marketplaceT("visits.none")}</h2><p>${message}</p></div>`;
        return;
    }

    const ownVisits = filteredVisits(visits.filter(isOwnVisit));
    const publicVisits = filteredVisits(visits.filter((visit) => visit.isPublic && !isOwnVisit(visit)));
    renderVisitCollection({
        title: marketplaceT("visits.mineHeading"),
        intro: marketplaceT("visits.mineIntro"),
        collection: ownVisits,
        emptyMessage: visitSearch.value.trim()
            ? marketplaceT("visits.noSearchResults")
            : marketplaceT("visits.createFirst", { museum: selectedMuseum.name }),
        isOwn: true
    });
    renderVisitCollection({
        title: marketplaceT("visits.publicHeading"),
        intro: marketplaceT("visits.publicIntro"),
        collection: publicVisits,
        emptyMessage: visitSearch.value.trim()
            ? marketplaceT("visits.noSearchResults")
            : marketplaceT("visits.noPublic"),
        isOwn: false
    });
}

function renderVisitCollection({ title, intro, collection, emptyMessage, isOwn }) {
    const section = document.createElement("section");
    section.classList.add("visit-collection");
    section.innerHTML = `
        <div class="visit-collection-heading">
            <h2>${escapeHTML(title)}</h2>
            <p>${escapeHTML(intro)}</p>
        </div>
        <div class="visits-grid"></div>
    `;
    const grid = section.querySelector(".visits-grid");

    if (collection.length === 0) {
        grid.innerHTML = `<div class="empty-state"><h2>${marketplaceT("visits.none")}</h2><p>${escapeHTML(emptyMessage)}</p></div>`;
        visitsContainer.appendChild(section);
        return;
    }

    collection.forEach((visit) => {
        const card = document.createElement("article");
        card.classList.add("visit-card");
        const author = visit.creatorId?.username || marketplaceT("visits.unknownAuthor");
        card.innerHTML = `
            <div>
                <span class="visit-label">${visit.type === "synchronized" ? marketplaceT("visits.group") : marketplaceT("visits.standard")}</span>
                <h2>${escapeHTML(visit.title || marketplaceT("visits.untitled"))}</h2>
                <p>${escapeHTML(visit.description || marketplaceT("visits.noIntroduction"))}</p>
            </div>
            <div class="visit-meta">
                <span>${marketplaceT("visits.contents", { count: visit.sequence?.length || 0 })}</span>
                <span>${visit.isPublic ? marketplaceT("common.public") : marketplaceT("common.private")}</span>
                ${isOwn ? "" : `<span>${escapeHTML(marketplaceT("visits.byAuthor", { author }))}</span>`}
            </div>
            <div class="visit-actions">
                ${isOwn
                    ? `<a class="secondary-btn" href="${visitEditorUrl(visit._id)}">${marketplaceT("common.edit")}</a>
                       <button class="delete-btn" type="button">${marketplaceT("common.delete")}</button>`
                    : `<a class="secondary-btn" href="${visitRunUrl(visit)}">${marketplaceT("visits.open")}</a>`}
            </div>
        `;
        const deleteButton = card.querySelector(".delete-btn");
        if (deleteButton) deleteButton.addEventListener("click", () => openDeleteModal(visit));
        grid.appendChild(card);
    });
    visitsContainer.appendChild(section);
}

async function loadVisits() {
    if (!selectedMuseum) return;
    feedback.textContent = marketplaceT("visits.loading");
    feedback.classList.remove("is-error");
    visitsContainer.innerHTML = "";
    try {
        const data = await api(`/museums/${encodeURIComponent(selectedMuseum._id)}/visits`);
        visits = data.visits || [];
        renderVisits();
        feedback.textContent = marketplaceT("visits.count", { count: visits.length });
    } catch (error) {
        feedback.textContent = marketplaceT("visits.loadError");
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
        visits = [];
        visitsContainer.innerHTML = `<div class="empty-state"><h2>${marketplaceT("visits.chooseMuseum")}</h2><p>${marketplaceT("visits.filteredByMuseum")}</p></div>`;
    }
}

async function loadMuseums() {
    try {
        const [meData, data] = await Promise.all([
            api("/auth/me"),
            api("/museums")
        ]);
        currentUserId = entityId(meData.user || meData);
        museums = data.museums || data || [];
        museumLoadFailed = false;
        renderMuseumOptions();
        const requested = new URLSearchParams(window.location.search).get("museumId");
        const saved = localStorage.getItem("marketplace_v2_museum");
        const initial = museums.some((museum) => museum._id === requested) ? requested
            : museums.some((museum) => museum._id === saved) ? saved : "";
        museumSelect.value = initial;
        selectMuseum(initial);
    } catch (error) {
        museumLoadFailed = true;
        renderMuseumOptions();
        feedback.textContent = marketplaceT("visits.museumLoadError");
        feedback.classList.add("is-error");
    }
}

function openDeleteModal(visit) {
    pendingDelete = visit;
    document.getElementById("delete-modal-text").textContent = marketplaceT("visits.willBeDeleted", {
        title: visit.title || marketplaceT("visits.untitled")
    });
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
        alert(marketplaceT("visits.deleteError"));
    } finally {
        button.disabled = false;
    }
});

museumSelect.addEventListener("change", () => selectMuseum(museumSelect.value));
visitSearch.addEventListener("input", renderVisits);
addButton.addEventListener("click", () => {
    if (selectedMuseum) window.location.href = visitEditorUrl();
});
window.addEventListener("marketplace:language-changed", () => {
    renderMuseumOptions();
    renderVisits();
    if (selectedMuseum && !feedback.classList.contains("is-error")) {
        feedback.textContent = marketplaceT("visits.count", { count: visits.length });
    }
    if (pendingDelete) openDeleteModal(pendingDelete);
});
loadMuseums();
