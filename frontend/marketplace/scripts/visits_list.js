const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;

const visitsContainer = document.getElementById("tours-list");
const searchBar = document.querySelector("#search-bar");

const urlParams = new URLSearchParams(window.location.search);
const currMuseumId = urlParams.get('museumId');
const currMuseumName = urlParams.get('museumName') || 'Museo';

let allTours = [];
let currentUserId = null;

const dayLabels = {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun"
};

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function setUpMuseumDatas() {
    const title = document.getElementById("museum-title-display") || document.querySelector(".title");
    if (title) title.textContent = currMuseumName;
}

function normalizeMuseumValue(value, fallback = "Non disponibile") {
    return value && String(value).trim() ? String(value).trim() : fallback;
}

function isSafeHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function renderMuseumHours(openingHours = {}) {
    return Object.entries(dayLabels).map(([key, label]) => {
        const value = normalizeMuseumValue(openingHours?.[key], "Chiuso");

        return `
            <div class="museum-hour-row">
                <span>${label}</span>
                <strong>${escapeHTML(value)}</strong>
            </div>
        `;
    }).join("");
}

function renderMuseumDetails(museum) {
    const detailsPanel = document.getElementById("QUESTA");
    if (!detailsPanel) return;

    const address = normalizeMuseumValue(museum.address);
    const description = normalizeMuseumValue(museum.description, "Nessun dettaglio disponibile per questo museo.");
    const website = normalizeMuseumValue(museum.website);
    const email = normalizeMuseumValue(museum.email);
    const phone = normalizeMuseumValue(museum.phone);
    const hasWebsite = museum.website && isSafeHttpUrl(String(museum.website).trim());
    const hasEmail = museum.email && isValidEmail(String(museum.email).trim());
    const hasPhone = museum.phone && String(museum.phone).trim();

    detailsPanel.innerHTML = `
        <div class="museum-details-header">
            <span class="museum-details-kicker">Scheda museo</span>
            <h2>Informazioni</h2>
        </div>

        <div class="museum-detail-group">
            <span class="museum-detail-label">Indirizzo</span>
            <p>${escapeHTML(address)}</p>
        </div>

        <div class="museum-detail-group">
            <span class="museum-detail-label">Dettagli</span>
            <p>${escapeHTML(description)}</p>
        </div>

        <div class="museum-extra-details">
            <button
                class="museum-extra-toggle"
                type="button"
                aria-expanded="false"
                aria-controls="museum-extra-content"
            >
                <span>Contatti e orari</span>
                <span class="museum-extra-arrow" aria-hidden="true"></span>
            </button>

            <div id="museum-extra-content" class="museum-extra-content" hidden>
                <div class="museum-extra-overlay">
                    <div class="museum-detail-group">
                        <span class="museum-detail-label">Contatti</span>
                        <ul class="museum-contact-list">
                            <li>
                                <span>Web</span>
                                ${hasWebsite ? `<a href="${escapeHTML(website)}" target="_blank" rel="noopener noreferrer">${escapeHTML(website)}</a>` : `<strong>${escapeHTML(website)}</strong>`}
                            </li>
                            <li>
                                <span>Email</span>
                                ${hasEmail ? `<a href="mailto:${escapeHTML(email)}">${escapeHTML(email)}</a>` : `<strong>${escapeHTML(email)}</strong>`}
                            </li>
                            <li>
                                <span>Telefono</span>
                                ${hasPhone ? `<a href="tel:${escapeHTML(phone)}">${escapeHTML(phone)}</a>` : `<strong>${escapeHTML(phone)}</strong>`}
                            </li>
                        </ul>
                    </div>

                    <div class="museum-detail-group museum-hours-group">
                        <span class="museum-detail-label">Orari di apertura</span>
                        <div class="museum-hours-grid">
                            ${renderMuseumHours(museum.openingHours)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupMuseumDetailsToggle(detailsPanel);
}

function setupMuseumDetailsToggle(detailsPanel) {
    const toggle = detailsPanel.querySelector(".museum-extra-toggle");
    const content = detailsPanel.querySelector("#museum-extra-content");

    if (!toggle || !content) return;

    const setExpanded = (isExpanded) => {
        toggle.setAttribute("aria-expanded", String(isExpanded));
        content.hidden = !isExpanded;
        detailsPanel.classList.toggle("is-expanded", isExpanded);
    };

    toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = toggle.getAttribute("aria-expanded") === "true";

        setExpanded(!isOpen);
    });

    content.addEventListener("click", (event) => {
        event.stopPropagation();
    });

    document.addEventListener("click", (event) => {
        if (!detailsPanel.contains(event.target)) {
            setExpanded(false);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            setExpanded(false);
        }
    });
}

function renderMuseumDetailsError() {
    const detailsPanel = document.getElementById("QUESTA");
    if (!detailsPanel) return;

    detailsPanel.innerHTML = `
        <div class="museum-details-header">
            <span class="museum-details-kicker">Scheda museo</span>
            <h2>Informazioni</h2>
        </div>
        <p class="museum-details-error">Impossibile caricare i dettagli del museo.</p>
    `;
}

async function loadMuseumDetails() {
    if (!currMuseumId) {
        renderMuseumDetailsError();
        return;
    }

    try {
        const res = await fetch(`${myApi}/museums/${currMuseumId}`);
        if (!res.ok) throw new Error("Museum details request failed");

        const data = await res.json();
        const museum = data.museum || data;

        if (museum?.name) {
            const title = document.getElementById("museum-title-display");
            if (title) title.textContent = museum.name;
        }

        renderMuseumDetails(museum);
    } catch (err) {
        console.error("Errore durante il caricamento dei dettagli museo:", err);
        renderMuseumDetailsError();
    }
}

function cleanVisitDescription(description) {
    let cleanDesc = description || "";
    const splitTag = "[Struttura Blocchi Salvata: ";

    if (cleanDesc.includes(splitTag)) {
        cleanDesc = cleanDesc.split(splitTag)[0].trim();
    }

    return cleanDesc || "Nessuna descrizione fornita per questo tour.";
}

function getEntityId(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value._id || value.id || "";
}

async function loadCurrentUserId(token) {
    if (!token) return null;

    try {
        const res = await fetch(`${myApi}/auth/me`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) return null;

        const data = await res.json();
        const user = data.user || data;
        return getEntityId(user);
    } catch (err) {
        console.error("Errore durante il caricamento dell'utente corrente:", err);
        return null;
    }
}

function mergePublicAndOwnedVisits(publicVisits = [], ownedVisits = []) {
    const visitsById = new Map();

    publicVisits.forEach((visit) => {
        const visitId = getEntityId(visit);
        const creatorId = getEntityId(visit.creatorId);

        visitsById.set(visitId, {
            ...visit,
            _isOwner: currentUserId && creatorId === currentUserId
        });
    });

    ownedVisits.forEach((visit) => {
        const visitId = getEntityId(visit);

        visitsById.set(visitId, {
            ...(visitsById.get(visitId) || {}),
            ...visit,
            _isOwner: true
        });
    });

    return Array.from(visitsById.values());
}

function renderVisitsList(visitsArr) {
    visitsContainer.innerHTML = "";

    if (visitsArr.length === 0) {
        visitsContainer.innerHTML = `
            <p class="visits-empty-message">No visits found for this museum.</p>
        `;
        return;
    }

    visitsArr.forEach((v) => {
        const cleanDesc = cleanVisitDescription(v.description);
        const visitTitle = escapeHTML(v.title || "Untitled tour");
        const isOwner = v._isOwner === true;
        const ownerActions = isOwner ? `
                <button class="visit-action-btn edit-btn" type="button">Edit</button>
                <button class="visit-action-btn delete-btn" type="button" aria-label="Delete visit">
                    <span aria-hidden="true">&times;</span>
                </button>
        ` : "";

        const visitIcon = document.createElement("article");
        visitIcon.className = "visit-card-modern";
        visitIcon.dataset.visitId = v._id || "";

        visitIcon.innerHTML = `
            <button class="favorite-visit-btn" type="button" aria-label="Save visit">
                <span class="heart-icon" aria-hidden="true">&#9825;</span>
            </button>

            <div class="visit-card-main">
                <span class="visit-card-label">Tour</span>
                <h3 class="visit-card-title">${visitTitle}</h3>
                <p class="visit-card-description">${escapeHTML(cleanDesc)}</p>
            </div>

            <div class="visit-card-actions">
                <button class="visit-action-btn start-btn" type="button">Start</button>
                ${ownerActions}
            </div>
        `;

        const editBtn = visitIcon.querySelector(".edit-btn");
        const startBtn = visitIcon.querySelector(".start-btn");
        const deleteBtn = visitIcon.querySelector(".delete-btn");
        const favBtn = visitIcon.querySelector(".favorite-visit-btn");
        const heartIcon = visitIcon.querySelector(".heart-icon");

        favBtn.onclick = async (e) => {
            e.stopPropagation();
            const token = localStorage.getItem("token");

            if (!token) {
                alert("Devi effettuare il login per salvare una visita nei preferiti.");
                window.location.href = "login.html";
                return;
            }

            favBtn.disabled = true;

            try {
                const res = await fetch(`${myApi}/auth/favorites/visits/${v._id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (res.ok) {
                    const data = await res.json();

                    if (data.isSaved) {
                        heartIcon.innerHTML = "&#9829;";
                        heartIcon.classList.add("saved");
                    } else {
                        heartIcon.innerHTML = "&#9825;";
                        heartIcon.classList.remove("saved");
                    }
                } else {
                    console.error("Errore risposta server");
                }
            } catch (err) {
                console.error("Errore rete nel salvataggio della visita:", err);
            } finally {
                favBtn.disabled = false;
            }
        };

        startBtn.onclick = (e) => {
            e.stopPropagation();
            window.location.href = `navigator.html?museumId=${currMuseumId}&visitId=${v._id}`;
        };

        if (editBtn) {
            editBtn.onclick = (e) => {
                e.stopPropagation();
                const token = localStorage.getItem("token");

                if (!token) {
                    alert("Devi effettuare il login per modificare una visita.");
                    window.location.href = "login.html";
                    return;
                }

                window.location.href = `create_visits.html?museumId=${currMuseumId}&museumName=${encodeURIComponent(currMuseumName)}&visitId=${v._id}`;
            };
        }

        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                const token = localStorage.getItem("token");

                if (!token) {
                    alert("Devi effettuare il login per eliminare una visita.");
                    window.location.href = "login.html";
                    return;
                }

                const deleteModal = document.getElementById("delete-confirm-modal");
                const deleteText = document.getElementById("delete-modal-text");
                const confirmBtn = document.getElementById("confirm-delete-btn");
                const cancelBtn = document.getElementById("cancel-delete-btn");

                deleteText.innerHTML = `
                    Sei sicuro di voler eliminare la visita<br>
                    <strong>"${visitTitle}"</strong>
                    <span>Questa azione &egrave; irreversibile.</span>
                `;
                deleteModal.classList.remove("hidden");

                cancelBtn.onclick = () => {
                    deleteModal.classList.add("hidden");
                };

                confirmBtn.onclick = async () => {
                    try {
                        confirmBtn.textContent = "Eliminazione...";
                        confirmBtn.classList.add("is-loading");
                        confirmBtn.disabled = true;

                        const res = await fetch(`${myApi}/visits/${v._id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (res.ok) {
                            deleteModal.classList.add("hidden");
                            loadList();
                        } else {
                            const errorData = await res.json();
                            alert(`Impossibile eliminare: ${errorData.error || "Non sei autorizzato"}`);
                            deleteModal.classList.add("hidden");
                        }
                    } catch (err) {
                        console.error("Errore eliminazione:", err);
                        alert("Errore di rete.");
                        deleteModal.classList.add("hidden");
                    } finally {
                        confirmBtn.textContent = "Elimina";
                        confirmBtn.classList.remove("is-loading");
                        confirmBtn.disabled = false;
                    }
                };
            };
        }

        visitsContainer.appendChild(visitIcon);
    });
}

function renderLoginRequiredState() {
    visitsContainer.innerHTML = `
        <div class="visits-empty-state">
            <span class="visits-state-label">Account richiesto</span>
            <h3>Vuoi esplorare le visite?</h3>
            <p>Devi effettuare il login per visualizzare o creare i tour di questo museo.</p>
            <button class="visits-login-btn" id="visits-login-btn" type="button">Vai al login</button>
        </div>
    `;

    document.getElementById("visits-login-btn")?.addEventListener("click", () => {
        window.location.href = "login.html";
    });
}

async function loadList() {
    if (!currMuseumId) {
        visitsContainer.innerHTML = `
            <p class="visits-error-message">Errore: ID museo mancante.</p>
        `;
        return;
    }

    const token = localStorage.getItem("token");

    try {
        currentUserId = await loadCurrentUserId(token);

        const publicRes = await fetch(`${myApi}/museums/${currMuseumId}/visits`, {
            headers: token ? { "Authorization": `Bearer ${token}` } : {}
        });

        if (!publicRes.ok) throw new Error("Errore dal server durante il caricamento delle visite pubbliche");

        const publicData = await publicRes.json();
        const publicVisits = publicData.visits || publicData || [];
        let ownedVisits = [];

        if (token) {
            const ownedRes = await fetch(`${myApi}/visits/my?museumId=${currMuseumId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (ownedRes.ok) {
                const ownedData = await ownedRes.json();
                ownedVisits = ownedData.visits || ownedData || [];
            }
        }

        allTours = mergePublicAndOwnedVisits(publicVisits, ownedVisits);
        renderVisitsList(allTours);
    } catch (err) {
        console.error("Errore durante il caricamento delle visite: " + err);
        visitsContainer.innerHTML = `
            <p class="visits-error-message">Errore di connessione. Prova a effettuare nuovamente il login.</p>
        `;
    }
}

function setupSearchListeners() {
    if (!searchBar) return;

    searchBar.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const filteredArr = allTours.filter((visit) => {
            const matchingName = visit.title && visit.title.toLowerCase().includes(searchTerm);
            const matchingDesc = visit.description && visit.description.toLowerCase().includes(searchTerm);

            return matchingName || matchingDesc;
        });

        renderVisitsList(filteredArr);
    });
}

function setupAddVisitBtn() {
    const addNewVisitBtn = document.getElementById("add-visit-btn");

    if (addNewVisitBtn) {
        addNewVisitBtn.addEventListener('click', () => {
            const token = localStorage.getItem("token");

            if (!token) {
                alert("Devi registrarti o effettuare il login per creare una nuova visita!");
                window.location.href = "login.html";
                return;
            }

            window.location.href = `create_visits.html?museumId=${currMuseumId}&museumName=${encodeURIComponent(currMuseumName)}`;
        });
    }
}

setUpMuseumDatas();
loadMuseumDetails();
loadList();
setupSearchListeners();
setupAddVisitBtn();
