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
let initializationStatus = "loading";

if (!token) window.location.replace("login.html");

const grid = document.getElementById("contents-grid");
const feedback = document.getElementById("items-feedback");
const museumSelect = document.getElementById("items-museum-select");
const search = document.getElementById("content-search");
feedback.textContent = marketplaceT("items.loadingContents");

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
    if (!response.ok) throw new Error(data.error || marketplaceT("errors.requestFailed"));
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

function contentTypeLabel(type) {
    const keyByType = {
        Artist: "items.typeArtist",
        Artwork: "items.typeArtwork",
        Movement: "items.typeMovement",
        bar: "items.typeBar",
        entrance: "items.typeEntrance",
        exit: "items.typeExit",
        shop: "items.typeShop",
        stairs: "items.typeStairs",
        toilet: "items.typeToilet"
    };
    return keyByType[type] ? marketplaceT(keyByType[type]) : (type || marketplaceT("common.content"));
}

function targetAudienceLabel(audience) {
    const keyByAudience = {
        general: "itemEditor.audienceGeneral",
        children: "itemEditor.audienceChildren",
        student: "itemEditor.audienceStudents",
        expert: "itemEditor.audienceExperts",
        tourist: "itemEditor.audienceTourists"
    };
    return keyByAudience[audience] ? marketplaceT(keyByAudience[audience]) : audience;
}

function renderMuseumOptions() {
    const selectedMuseumId = museumSelect.value;
    museumSelect.innerHTML = `<option value="">${marketplaceT("items.allMuseums")}</option>`
        + museums.map((museum) => `<option value="${museum._id}">${escapeHTML(museum.name)}</option>`).join("");
    museumSelect.value = selectedMuseumId;
}

function renderContents() {
    const visible = filteredContents();
    if (visible.length === 0) {
        grid.innerHTML = `<div class="empty-state">${marketplaceT("items.noFilteredContent")}</div>`;
        return;
    }
    grid.innerHTML = visible.map((content) => `
        <button class="content-card" type="button" data-content-id="${escapeHTML(content.universalId)}" data-museum-id="${content.museum._id}">
            <img src="${escapeHTML(content.imageUrl || "/uploads/placeholders/template-no-image.jpg")}" alt="" />
            <span class="content-card-copy">
                <span>${escapeHTML(content.museum.name)} · ${escapeHTML(contentTypeLabel(content.type))}</span>
                <strong>${escapeHTML(content.name || marketplaceT("items.untitled"))}</strong>
                <span>${escapeHTML(content.author || marketplaceT("items.authorMissing"))}</span>
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
        title: currentContent.name || marketplaceT("common.content"),
        author: currentContent.author || "",
        image: currentContent.imageUrl || "",
        year: currentContent.year || marketplaceT("common.notAvailable"),
        contentId: currentContent.universalId,
        source: "my-items"
    });
    if (itemId) params.set("itemId", itemId);
    return `create_items.html?${params.toString()}`;
}

function itemSummary(item) {
    const creator = item.creatorId?.username || marketplaceT("common.author");
    return `${creator} · ${targetAudienceLabel(item.targetAudience || "general")} · ${item.license || "CC-BY"}`;
}

function renderItemRow(item, actions) {
    return `<article class="item-row">
        <div><h3>${escapeHTML(itemSummary(item))}</h3><p>${marketplaceT("items.tones", { count: item.descriptions?.length || 0 })} · ${Number(item.price) || 0} ${marketplaceT("common.credits")}</p></div>
        <div class="item-actions">${actions}</div>
    </article>`;
}

function renderDetail() {
    const list = document.getElementById("items-detail-list");
    document.querySelectorAll(".tab-btn").forEach((button) => button.classList.toggle("active", button.dataset.tab === activeTab));
    if (activeTab === "mine") {
        const mine = currentItems.filter((item) => item.isOwned);
        list.innerHTML = `
            <div class="available-heading"><h3>${marketplaceT("items.myItems")}</h3><a class="primary-btn" href="${itemEditorUrl()}">${marketplaceT("items.createNew")}</a></div>
            ${mine.length ? mine.map((item) => renderItemRow(item, `<a class="secondary-btn" href="${itemEditorUrl(item._id)}">${marketplaceT("common.edit")}</a><button class="danger-btn" data-delete-id="${item._id}" type="button">${marketplaceT("common.delete")}</button>`)).join("") : `<div class="empty-state">${marketplaceT("items.noneCreated")}</div>`}
        `;
        list.querySelectorAll("[data-delete-id]").forEach((button) => button.addEventListener("click", () => deleteItem(button.dataset.deleteId)));
        return;
    }

    const purchased = currentItems.filter((item) => item.isPurchased && !item.isOwned);
    const available = currentItems.filter((item) => item.isPublic && !item.isOwned && !item.isPurchased);
    list.innerHTML = `
        <div class="available-heading"><h3>${marketplaceT("items.purchased")}</h3><button id="toggle-available" class="secondary-btn" type="button">${showAvailable ? marketplaceT("items.hideAvailable") : marketplaceT("items.showAvailable")}</button></div>
        ${purchased.length ? purchased.map((item) => renderItemRow(item, `<a class="secondary-btn" href="${itemEditorUrl(item._id)}">${marketplaceT("common.view")}</a>`)).join("") : `<div class="empty-state">${marketplaceT("items.nonePurchased")}</div>`}
        ${showAvailable ? `<div class="available-heading"><h3>${marketplaceT("items.marketplace")}</h3></div>${available.length ? available.map((item) => renderItemRow(item, `<a class="secondary-btn" href="${itemEditorUrl(item._id)}">${marketplaceT("common.details")}</a><button class="primary-btn" data-buy-id="${item._id}" type="button">${marketplaceT("items.buy")}</button>`)).join("") : `<div class="empty-state">${marketplaceT("items.noneAvailable")}</div>`}` : ""}
    `;
    document.getElementById("toggle-available")?.addEventListener("click", () => { showAvailable = !showAvailable; renderDetail(); });
    list.querySelectorAll("[data-buy-id]").forEach((button) => button.addEventListener("click", () => purchaseItem(button.dataset.buyId)));
}

async function openContent() {
    document.getElementById("content-detail").classList.remove("hidden");
    document.getElementById("detail-title").textContent = currentContent.name || marketplaceT("common.content");
    document.getElementById("detail-author").textContent = currentContent.author || marketplaceT("items.authorMissing");
    document.getElementById("detail-museum").textContent = currentContent.museum.name;
    document.getElementById("items-detail-list").innerHTML = `<div class="empty-state">${marketplaceT("items.loadingItems")}</div>`;
    activeTab = "mine";
    showAvailable = false;
    try {
        const data = await api(`/items?contentId=${encodeURIComponent(currentContent.universalId)}`);
        currentItems = data.items || [];
        renderDetail();
    } catch (error) {
        document.getElementById("items-detail-list").innerHTML = `<div class="empty-state">${marketplaceT("items.loadItemsError")}</div>`;
    }
}

async function deleteItem(itemId) {
    if (!confirm(marketplaceT("items.deleteConfirm"))) return;
    try {
        await api(`/items/${itemId}`, { method:"DELETE" });
        currentItems = currentItems.filter((item) => item._id !== itemId);
        renderDetail();
    } catch (error) { alert(marketplaceT("items.deleteError")); }
}

async function purchaseItem(itemId) {
    const item = currentItems.find((candidate) => candidate._id === itemId);
    if (!confirm(marketplaceT("items.purchaseConfirm", { price: Number(item?.price) || 0 }))) return;
    try {
        await api(`/items/${itemId}/purchase`, { method:"POST" });
        item.isPurchased = true;
        renderDetail();
    } catch (error) {
        alert(marketplaceT(
            error.message === "Insufficient balance"
                ? "items.insufficientBalance"
                : "items.purchaseError"
        ));
    }
}

async function initialize() {
    try {
        const museumData = await api("/museums");
        museums = museumData.museums || museumData || [];
        renderMuseumOptions();
        const contentResponses = await Promise.all(museums.map(async (museum) => {
            const data = await api(`/museums/${encodeURIComponent(museum._id)}/contents`);
            return (data.contents || []).map((content) => ({ ...content, museum }));
        }));
        contents = contentResponses.flat();
        initializationStatus = "loaded";
        feedback.textContent = marketplaceT("items.availableContents", { count: contents.length });
        renderContents();
        const requestedContent = new URLSearchParams(window.location.search).get("contentId");
        if (requestedContent) {
            currentContent = contents.find((content) => content.universalId === requestedContent);
            if (currentContent) openContent();
        }
    } catch (error) {
        initializationStatus = "error";
        feedback.textContent = marketplaceT("items.loadError");
        feedback.classList.add("is-error");
    }
}

museumSelect.addEventListener("change", renderContents);
search.addEventListener("input", renderContents);
document.getElementById("close-detail").addEventListener("click", () => document.getElementById("content-detail").classList.add("hidden"));
document.querySelectorAll(".tab-btn").forEach((button) => button.addEventListener("click", () => { activeTab = button.dataset.tab; showAvailable = false; renderDetail(); }));
window.addEventListener("marketplace:language-changed", () => {
    renderMuseumOptions();
    renderContents();
    if (initializationStatus === "loaded") {
        feedback.textContent = marketplaceT("items.availableContents", { count: contents.length });
    } else if (initializationStatus === "error") {
        feedback.textContent = marketplaceT("items.loadError");
    } else {
        feedback.textContent = marketplaceT("items.loadingContents");
    }
    if (currentContent && !document.getElementById("content-detail").classList.contains("hidden")) {
        renderDetail();
    }
});
initialize();
