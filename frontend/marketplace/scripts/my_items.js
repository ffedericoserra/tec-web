const isLocal = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1");
const baseUrl = isLocal ? "http://localhost:8000" : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token") || localStorage.getItem("artaround_token");

let museums = [];
let contents = [];
let currentContent = null;
let currentItems = [];
let activeTab = "mine";
let showAvailable = false;

if (!token) window.location.replace("login.html");

const grid = document.getElementById("contents-grid");
const feedback = document.getElementById("items-feedback");
const museumSelect = document.getElementById("items-museum-select");
const search = document.getElementById("content-search");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[char]);
}

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

function filteredContents() {
    const museumId = museumSelect.value;
    const term = search.value.trim().toLowerCase();
    return contents.filter((content) => {
        const matchesMuseum = !museumId || content.museum._id === museumId;
        const haystack = `${content.name || ""} ${content.author || ""}`.toLowerCase();
        return matchesMuseum && haystack.includes(term);
    });
}

function renderContents() {
    const visible = filteredContents();
    if (visible.length === 0) {
        grid.innerHTML = `<div class="empty-state">Nessun Content corrisponde ai filtri scelti.</div>`;
        return;
    }
    grid.innerHTML = visible.map((content) => `
        <button class="content-card" type="button" data-content-id="${escapeHTML(content.universalId)}" data-museum-id="${content.museum._id}">
            <img src="${escapeHTML(content.imageUrl || "/uploads/placeholders/template-no-image.jpg")}" alt="" />
            <span class="content-card-copy">
                <span>${escapeHTML(content.museum.name)} · ${escapeHTML(content.type || "Content")}</span>
                <strong>${escapeHTML(content.name || "Senza titolo")}</strong>
                <span>${escapeHTML(content.author || "Autore non indicato")}</span>
            </span>
        </button>
    `).join("");
    grid.querySelectorAll(".content-card").forEach((card) => card.addEventListener("click", () => {
        currentContent = contents.find((content) => content.universalId === card.dataset.contentId && content.museum._id === card.dataset.museumId);
        openContent();
    }));
}

function itemEditorUrl(itemId = "") {
    const params = new URLSearchParams({
        museumId: currentContent.museum._id,
        museumName: currentContent.museum.name,
        title: currentContent.name || "Content",
        author: currentContent.author || "",
        image: currentContent.imageUrl || "",
        year: currentContent.year || "N/D",
        contentId: currentContent.universalId,
        source: "my-items"
    });
    if (itemId) params.set("itemId", itemId);
    return `create_items.html?${params.toString()}`;
}

function itemSummary(item) {
    const creator = item.creatorId?.username || "Autore";
    return `${creator} · ${item.targetAudience || "general"} · ${item.license || "CC-BY"}`;
}

function renderItemRow(item, actions) {
    return `<article class="item-row">
        <div><h3>${escapeHTML(itemSummary(item))}</h3><p>${item.descriptions?.length || 0} toni · ${Number(item.price) || 0} crediti</p></div>
        <div class="item-actions">${actions}</div>
    </article>`;
}

function renderDetail() {
    const list = document.getElementById("items-detail-list");
    document.querySelectorAll(".tab-btn").forEach((button) => button.classList.toggle("active", button.dataset.tab === activeTab));
    if (activeTab === "mine") {
        const mine = currentItems.filter((item) => item.isOwned);
        list.innerHTML = `
            <div class="available-heading"><h3>I miei Item</h3><a class="primary-btn" href="${itemEditorUrl()}">Crea nuovo Item</a></div>
            ${mine.length ? mine.map((item) => renderItemRow(item, `<a class="secondary-btn" href="${itemEditorUrl(item._id)}">Modifica</a><button class="danger-btn" data-delete-id="${item._id}" type="button">Elimina</button>`)).join("") : '<div class="empty-state">Non hai ancora creato Item per questo Content.</div>'}
        `;
        list.querySelectorAll("[data-delete-id]").forEach((button) => button.addEventListener("click", () => deleteItem(button.dataset.deleteId)));
        return;
    }

    const purchased = currentItems.filter((item) => item.isPurchased && !item.isOwned);
    const available = currentItems.filter((item) => item.isPublic && !item.isOwned && !item.isPurchased);
    list.innerHTML = `
        <div class="available-heading"><h3>Item acquistati</h3><button id="toggle-available" class="secondary-btn" type="button">${showAvailable ? "Nascondi disponibili" : "Vedi tutti i disponibili"}</button></div>
        ${purchased.length ? purchased.map((item) => renderItemRow(item, `<a class="secondary-btn" href="${itemEditorUrl(item._id)}">Visualizza</a>`)).join("") : '<div class="empty-state">Non hai ancora acquistato Item per questo Content.</div>'}
        ${showAvailable ? `<div class="available-heading"><h3>Marketplace</h3></div>${available.length ? available.map((item) => renderItemRow(item, `<a class="secondary-btn" href="${itemEditorUrl(item._id)}">Dettagli</a><button class="primary-btn" data-buy-id="${item._id}" type="button">Acquista</button>`)).join("") : '<div class="empty-state">Non ci sono altri Item pubblici disponibili.</div>'}` : ""}
    `;
    document.getElementById("toggle-available")?.addEventListener("click", () => { showAvailable = !showAvailable; renderDetail(); });
    list.querySelectorAll("[data-buy-id]").forEach((button) => button.addEventListener("click", () => purchaseItem(button.dataset.buyId)));
}

async function openContent() {
    document.getElementById("content-detail").classList.remove("hidden");
    document.getElementById("detail-title").textContent = currentContent.name || "Content";
    document.getElementById("detail-author").textContent = currentContent.author || "Autore non indicato";
    document.getElementById("detail-museum").textContent = currentContent.museum.name;
    document.getElementById("items-detail-list").innerHTML = `<div class="empty-state">Caricamento Item...</div>`;
    activeTab = "mine";
    showAvailable = false;
    try {
        const data = await api(`/items?contentId=${encodeURIComponent(currentContent.universalId)}`);
        currentItems = data.items || [];
        renderDetail();
    } catch (error) {
        document.getElementById("items-detail-list").innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`;
    }
}

async function deleteItem(itemId) {
    if (!confirm("Eliminare definitivamente questo Item?")) return;
    try {
        await api(`/items/${itemId}`, { method:"DELETE" });
        currentItems = currentItems.filter((item) => item._id !== itemId);
        renderDetail();
    } catch (error) { alert(error.message); }
}

async function purchaseItem(itemId) {
    const item = currentItems.find((candidate) => candidate._id === itemId);
    if (!confirm(`Acquistare questo Item per ${Number(item?.price) || 0} crediti?`)) return;
    try {
        await api(`/items/${itemId}/purchase`, { method:"POST" });
        item.isPurchased = true;
        renderDetail();
    } catch (error) { alert(error.message); }
}

async function initialize() {
    try {
        const museumData = await api("/museums");
        museums = museumData.museums || museumData || [];
        museumSelect.innerHTML = `<option value="">Tutti i musei</option>` + museums.map((museum) => `<option value="${museum._id}">${escapeHTML(museum.name)}</option>`).join("");
        const contentResponses = await Promise.all(museums.map(async (museum) => {
            const data = await api(`/museums/${encodeURIComponent(museum._id)}/contents`);
            return (data.contents || []).map((content) => ({ ...content, museum }));
        }));
        contents = contentResponses.flat();
        feedback.textContent = `${contents.length} Content disponibili`;
        renderContents();
        const requestedContent = new URLSearchParams(window.location.search).get("contentId");
        if (requestedContent) {
            currentContent = contents.find((content) => content.universalId === requestedContent);
            if (currentContent) openContent();
        }
    } catch (error) {
        feedback.textContent = error.message;
        feedback.classList.add("is-error");
    }
}

museumSelect.addEventListener("change", renderContents);
search.addEventListener("input", renderContents);
document.getElementById("close-detail").addEventListener("click", () => document.getElementById("content-detail").classList.add("hidden"));
document.querySelectorAll(".tab-btn").forEach((button) => button.addEventListener("click", () => { activeTab = button.dataset.tab; showAvailable = false; renderDetail(); }));
initialize();
