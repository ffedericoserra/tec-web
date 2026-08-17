const isLocal = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1");
const baseUrl = isLocal ? "http://localhost:8000" : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token") || localStorage.getItem("artaround_token");
const params = new URLSearchParams(window.location.search);
const museumId = params.get("museumId");
const museumName = params.get("museumName") || "Museo";
const visitId = params.get("visitId");
const DRAFT_KEY = "marketplace_v2_visit_draft";

let museumContents = [];
let user = null;
let sequence = [];
let quiz = [];
let selectedContent = null;

if (!token) window.location.replace("login.html");
if (!museumId) window.location.replace("visits_list.html");

const elements = {
    title: document.getElementById("visit-title"),
    description: document.getElementById("visit-description"),
    length: document.getElementById("visit-length"),
    isPublic: document.getElementById("visit-public"),
    group: document.getElementById("group-visit"),
    sequence: document.getElementById("sequence-list"),
    quizSection: document.getElementById("quiz-section"),
    quiz: document.getElementById("quiz-list"),
    feedback: document.getElementById("editor-feedback"),
    modal: document.getElementById("content-modal"),
    picker: document.getElementById("content-picker")
};

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

function entityId(value) {
    if (!value) return "";
    return typeof value === "string" ? value : value._id || value.id || "";
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

function contentFor(uid) {
    return museumContents.find((content) => content.universalId === uid);
}

function displayItem(item) {
    const creator = item.creatorId?.username || (item.isOwned ? user?.username : "Autore marketplace");
    return `${creator} · ${item.targetAudience || "general"}`;
}

function collectDraft() {
    return {
        museumId,
        visitId,
        title: elements.title.value,
        description: elements.description.value,
        length: elements.length.value,
        isPublic: elements.isPublic.checked,
        group: elements.group.checked,
        sequence,
        quiz
    };
}

function saveDraft() {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraft()));
}

function restoreDraft() {
    if (params.get("resume") !== "1") return false;
    try {
        const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
        if (!draft || draft.museumId !== museumId || String(draft.visitId || "") !== String(visitId || "")) return false;
        elements.title.value = draft.title || "";
        elements.description.value = draft.description || "";
        elements.length.value = draft.length || "normal";
        elements.isPublic.checked = Boolean(draft.isPublic);
        elements.group.checked = Boolean(draft.group);
        sequence = draft.sequence || [];
        quiz = draft.quiz || [];
        return true;
    } catch {
        return false;
    }
}

function renderSequence() {
    elements.sequence.innerHTML = "";
    if (sequence.length === 0) {
        elements.sequence.innerHTML = `<div class="empty-state">Aggiungi il primo Content e scegli quale Item utilizzare.</div>`;
        return;
    }

    sequence.forEach((entry, index) => {
        const content = contentFor(entry.contentId) || {};
        const card = document.createElement("article");
        card.className = "sequence-card";
        card.innerHTML = `
            <span class="sequence-number">${index + 1}</span>
            <div>
                <h3>${escapeHTML(content.name || entry.contentName || "Contenuto")}</h3>
                <p>${escapeHTML(content.author || entry.contentAuthor || "")} ${content.type ? `· ${escapeHTML(content.type)}` : ""}</p>
                <p><strong>Item:</strong> ${escapeHTML(entry.itemLabel || entry.itemId)}</p>
            </div>
            <div class="card-actions">
                <button class="icon-btn move-up" type="button" aria-label="Sposta su" ${index === 0 ? "disabled" : ""}>↑</button>
                <button class="icon-btn move-down" type="button" aria-label="Sposta giù" ${index === sequence.length - 1 ? "disabled" : ""}>↓</button>
                <button class="icon-btn remove-entry" type="button" aria-label="Rimuovi">&times;</button>
            </div>
            <label class="route-field"><span>Indicazioni verso il contenuto successivo</span><textarea rows="2" placeholder="Facoltative">${escapeHTML(entry.nextDirections || "")}</textarea></label>
        `;
        card.querySelector(".move-up").addEventListener("click", () => moveEntry(index, -1));
        card.querySelector(".move-down").addEventListener("click", () => moveEntry(index, 1));
        card.querySelector(".remove-entry").addEventListener("click", () => {
            sequence.splice(index, 1);
            renderSequence();
        });
        card.querySelector("textarea").addEventListener("input", (event) => {
            entry.nextDirections = event.target.value;
        });
        elements.sequence.appendChild(card);
    });
}

function moveEntry(index, offset) {
    const target = index + offset;
    if (target < 0 || target >= sequence.length) return;
    const [entry] = sequence.splice(index, 1);
    sequence.splice(target, 0, entry);
    renderSequence();
}

function renderQuiz() {
    elements.quizSection.classList.toggle("hidden", !elements.group.checked);
    elements.quiz.innerHTML = "";
    if (!elements.group.checked) return;
    if (quiz.length === 0) {
        elements.quiz.innerHTML = `<div class="empty-state">Aggiungi almeno una domanda per configurare il quiz finale.</div>`;
        return;
    }

    quiz.forEach((question, index) => {
        const card = document.createElement("article");
        card.className = "quiz-card";
        card.innerHTML = `
            <div class="quiz-card-head"><h3>Domanda ${index + 1}</h3><button class="danger-btn" type="button">Rimuovi</button></div>
            <label><span>Domanda</span><input class="question-text" type="text" value="${escapeHTML(question.question || "")}" /></label>
            <div class="quiz-options">
                ${question.options.map((option, optionIndex) => `<label><span>Risposta ${optionIndex + 1}</span><input class="option-text" data-index="${optionIndex}" type="text" value="${escapeHTML(option)}" /></label>`).join("")}
            </div>
            <label class="quiz-correct"><span>Risposta corretta</span>
                <select class="correct-answer">${question.options.map((_, optionIndex) => `<option value="${optionIndex}"${question.correctIndex === optionIndex ? " selected" : ""}>Risposta ${optionIndex + 1}</option>`).join("")}</select>
            </label>
        `;
        card.querySelector(".danger-btn").addEventListener("click", () => { quiz.splice(index, 1); renderQuiz(); });
        card.querySelector(".question-text").addEventListener("input", (event) => { question.question = event.target.value; });
        card.querySelectorAll(".option-text").forEach((input) => input.addEventListener("input", (event) => {
            question.options[Number(event.target.dataset.index)] = event.target.value;
        }));
        card.querySelector(".correct-answer").addEventListener("change", (event) => { question.correctIndex = Number(event.target.value); });
        elements.quiz.appendChild(card);
    });
}

function availableContents() {
    const used = new Set(sequence.map((entry) => entry.contentId));
    return museumContents.filter((content) => content.universalId && !used.has(content.universalId));
}

function renderContentPicker() {
    selectedContent = null;
    document.getElementById("modal-step-label").textContent = "1 / 2";
    document.getElementById("content-modal-title").textContent = "Scegli un Content";
    document.getElementById("back-to-contents").classList.add("hidden");
    const contents = availableContents();
    if (contents.length === 0) {
        elements.picker.innerHTML = `<div class="empty-state">Tutti i contenuti disponibili sono già nella visita.</div>`;
        return;
    }
    elements.picker.innerHTML = contents.map((content) => `
        <button class="content-choice" type="button" data-content-id="${escapeHTML(content.universalId)}">
            <img src="${escapeHTML(content.imageUrl || "/uploads/placeholders/template-no-image.jpg")}" alt="" />
            <strong>${escapeHTML(content.name || "Contenuto")}</strong>
            <span class="choice-meta">${escapeHTML(content.author || content.type || "")}</span>
        </button>
    `).join("");
    elements.picker.querySelectorAll(".content-choice").forEach((button) => button.addEventListener("click", () => {
        selectedContent = contentFor(button.dataset.contentId);
        renderItemPicker();
    }));
}

async function renderItemPicker() {
    document.getElementById("modal-step-label").textContent = "2 / 2";
    document.getElementById("content-modal-title").textContent = selectedContent.name || "Scegli un Item";
    document.getElementById("back-to-contents").classList.remove("hidden");
    elements.picker.innerHTML = `<div class="empty-state">Caricamento item...</div>`;
    try {
        const data = await api(`/items?contentId=${encodeURIComponent(selectedContent.universalId)}`);
        const items = data.items || [];
        const owned = items.filter((item) => item.isOwned || item.isPurchased);
        const available = items.filter((item) => item.isPublic && !item.isOwned && !item.isPurchased);
        const editParams = new URLSearchParams({
            museumId,
            museumName,
            title: selectedContent.name || "Contenuto",
            author: selectedContent.author || "",
            image: selectedContent.imageUrl || "",
            year: selectedContent.year || "N/D",
            contentId: selectedContent.universalId,
            source: "visit-editor"
        });
        if (visitId) editParams.set("visitId", visitId);
        elements.picker.innerHTML = `
            ${owned.map((item) => itemCard(item, "Usa questo item", "select")).join("")}
            ${available.map((item) => itemCard(item, `Acquista · ${Number(item.price) || 0} crediti`, "purchase")).join("")}
            <a class="item-choice create-item-card" href="create_items.html?${editParams.toString()}"><strong>Crea un nuovo Item</strong><span class="choice-meta">Scrivi una nuova descrizione per questo Content.</span></a>
        `;
        elements.picker.querySelectorAll("[data-action='select']").forEach((button) => button.addEventListener("click", () => {
            const item = items.find((candidate) => candidate._id === button.dataset.itemId);
            addSelectedItem(item);
        }));
        elements.picker.querySelectorAll("[data-action='purchase']").forEach((button) => button.addEventListener("click", async () => {
            const item = items.find((candidate) => candidate._id === button.dataset.itemId);
            if (!confirm(`Acquistare questo Item per ${Number(item.price) || 0} crediti?`)) return;
            button.disabled = true;
            try {
                await api(`/items/${item._id}/purchase`, { method: "POST" });
                item.isPurchased = true;
                addSelectedItem(item);
            } catch (error) {
                alert(error.message);
                button.disabled = false;
            }
        }));
        elements.picker.querySelector(".create-item-card")?.addEventListener("click", saveDraft);
    } catch (error) {
        elements.picker.innerHTML = `<div class="empty-state">${escapeHTML(error.message)}</div>`;
    }
}

function itemCard(item, actionLabel, action) {
    return `<button class="item-choice" type="button" data-action="${action}" data-item-id="${item._id}">
        <strong>${escapeHTML(displayItem(item))}</strong>
        <span class="choice-meta">${escapeHTML(item.license || "CC-BY")} · ${item.descriptions?.length || 0} toni</span>
        <span class="price">${escapeHTML(actionLabel)}</span>
    </button>`;
}

function addSelectedItem(item) {
    sequence.push({
        itemId: item._id,
        contentId: selectedContent.universalId,
        contentName: selectedContent.name,
        contentAuthor: selectedContent.author,
        itemLabel: displayItem(item),
        nextDirections: "",
        prevDirections: ""
    });
    elements.modal.classList.add("hidden");
    renderSequence();
}

function visitPayload() {
    return {
        title: elements.title.value.trim(),
        museumId,
        description: elements.description.value.trim(),
        length: elements.length.value,
        isPublic: elements.isPublic.checked,
        type: elements.group.checked ? "synchronized" : "standard",
        sequence: sequence.map((entry, index) => ({
            itemId: entry.itemId,
            prevDirections: index === 0 ? "" : sequence[index - 1].nextDirections || "",
            nextDirections: entry.nextDirections || ""
        })),
        blocks: [],
        quiz: elements.group.checked ? quiz.map((question) => ({
            question: question.question.trim(),
            options: question.options.map((option) => option.trim()),
            correctIndex: question.correctIndex
        })) : []
    };
}

function validate(payload) {
    if (!payload.title) return "Inserisci un titolo per la visita.";
    if (payload.sequence.length === 0) return "Aggiungi almeno un contenuto alla visita.";
    if (payload.type === "synchronized") {
        if (payload.quiz.length === 0) return "Aggiungi almeno una domanda al quiz finale.";
        if (payload.quiz.some((question) => !question.question || question.options.some((option) => !option))) {
            return "Completa tutte le domande e le risposte del quiz.";
        }
    }
    return "";
}

async function saveVisit() {
    const payload = visitPayload();
    const error = validate(payload);
    if (error) { elements.feedback.textContent = error; return; }
    const button = document.getElementById("save-visit-btn");
    button.disabled = true;
    elements.feedback.textContent = "Salvataggio...";
    try {
        await api(visitId ? `/visits/${visitId}` : "/visits", {
            method: visitId ? "PUT" : "POST",
            body: JSON.stringify(payload)
        });
        sessionStorage.removeItem(DRAFT_KEY);
        window.location.href = `visits_list.html?museumId=${encodeURIComponent(museumId)}`;
    } catch (saveError) {
        elements.feedback.textContent = saveError.message;
        button.disabled = false;
    }
}

async function initialize() {
    document.getElementById("museum-name").textContent = museumName;
    document.getElementById("back-link").href = `visits_list.html?museumId=${encodeURIComponent(museumId)}`;
    document.getElementById("cancel-link").href = `visits_list.html?museumId=${encodeURIComponent(museumId)}`;
    try {
        const [userData, contentsData] = await Promise.all([
            api("/auth/me"),
            api(`/museums/${encodeURIComponent(museumId)}/contents`)
        ]);
        user = userData.user || userData;
        museumContents = contentsData.contents || [];
        const restored = restoreDraft();
        if (!restored && visitId) {
            const data = await api(`/visits/${encodeURIComponent(visitId)}`);
            const visit = data.visit || data;
            elements.title.value = visit.title || "";
            elements.description.value = visit.description || "";
            elements.length.value = visit.length || "normal";
            elements.isPublic.checked = Boolean(visit.isPublic);
            elements.group.checked = visit.type === "synchronized";
            sequence = (visit.sequence || []).filter((entry) => entry.itemId).map((entry) => {
                const item = entry.itemId;
                const content = contentFor(item.contentId) || {};
                return {
                    itemId: entityId(item),
                    contentId: item.contentId,
                    contentName: content.name,
                    contentAuthor: content.author,
                    itemLabel: displayItem(item),
                    nextDirections: entry.nextDirections || "",
                    prevDirections: entry.prevDirections || ""
                };
            });
            quiz = (visit.quiz || []).map((question) => ({
                question: question.question || "",
                options: question.options?.length >= 2 ? question.options : ["", "", ""],
                correctIndex: Number.isInteger(question.correctIndex) ? question.correctIndex : 0
            }));
            document.getElementById("editor-title").textContent = "Modifica visita";
        } else if (!restored) {
            elements.length.value = "normal";
            elements.isPublic.checked = true;
        }
        renderSequence();
        renderQuiz();
    } catch (error) {
        elements.feedback.textContent = error.message;
    }
}

document.getElementById("add-content-btn").addEventListener("click", () => {
    elements.modal.classList.remove("hidden");
    renderContentPicker();
});
document.getElementById("close-content-modal").addEventListener("click", () => elements.modal.classList.add("hidden"));
document.getElementById("back-to-contents").addEventListener("click", renderContentPicker);
elements.group.addEventListener("change", renderQuiz);
document.getElementById("add-question-btn").addEventListener("click", () => {
    quiz.push({ question: "", options: ["", "", ""], correctIndex: 0 });
    renderQuiz();
});
document.getElementById("save-visit-btn").addEventListener("click", saveVisit);
initialize();
