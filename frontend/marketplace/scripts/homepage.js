const isLocal = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1");
const baseUrl = isLocal ? "http://localhost:8000" : window.location.origin;
const myApi = `${baseUrl}/api`;
const museumPlaceholder = "/uploads/placeholders/template-no-image.jpg";

let museums = [];
let museumLoadStatus = "loading";

const museumGrid = document.getElementById("museum-list");
const museumSearch = document.getElementById("museum-search");
const museumFeedback = document.getElementById("museum-feedback");

function visitListUrl(museum) {
    const params = new URLSearchParams({
        museumId: museum._id,
        museumName: museum.name || marketplaceT("common.museum")
    });
    return `visits_list.html?${params.toString()}`;
}

function createMuseumCard(museum) {
    const card = document.createElement("button");
    card.type = "button";
    card.classList.add("museum-card");
    card.setAttribute("aria-label", marketplaceT("home.openVisits", {
        museum: museum.name || marketplaceT("home.thisMuseum")
    }));

    const image = document.createElement("img");
    image.classList.add("museum-card-image");
    image.src = museum.imageUrl || museumPlaceholder;
    image.alt = museum.name || marketplaceT("common.museum");
    image.addEventListener("error", () => {
        image.src = museumPlaceholder;
    }, { once: true });

    const copy = document.createElement("span");
    copy.classList.add("museum-card-copy");

    const type = document.createElement("span");
    type.classList.add("museum-card-label");
    type.textContent = marketplaceT("common.museum");

    const title = document.createElement("strong");
    title.textContent = museum.name || marketplaceT("home.unnamedMuseum");

    const location = document.createElement("span");
    location.classList.add("museum-card-location");
    location.textContent = museum.address || marketplaceT("home.destinationAvailable");

    copy.append(type, title, location);
    card.append(image, copy);
    card.addEventListener("click", () => {
        window.location.href = visitListUrl(museum);
    });
    return card;
}

function renderMuseums() {
    const term = museumSearch.value.trim().toLowerCase();
    const visible = museums.filter((museum) =>
        `${museum.name || ""} ${museum.address || ""}`.toLowerCase().includes(term)
    );

    museumGrid.innerHTML = "";
    if (visible.length === 0) {
        const empty = document.createElement("p");
        empty.classList.add("museum-empty-state");
        empty.textContent = marketplaceT("home.noResults");
        museumGrid.appendChild(empty);
    } else {
        visible.forEach((museum) => museumGrid.appendChild(createMuseumCard(museum)));
    }
    museumFeedback.textContent = marketplaceT("home.availableMuseums", { count: visible.length });
}

async function loadMuseums() {
    museumFeedback.textContent = marketplaceT("home.loadingMuseums");
    try {
        const response = await fetch(`${myApi}/museums`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(marketplaceT("home.loadError"));
        museums = data.museums || data || [];
        museumLoadStatus = "loaded";
        renderMuseums();
    } catch (error) {
        museumLoadStatus = "error";
        museumFeedback.textContent = marketplaceT("home.loadError");
        museumFeedback.classList.add("is-error");
        museumGrid.innerHTML = "";
    }
}

museumSearch.addEventListener("input", renderMuseums);
window.addEventListener("marketplace:language-changed", () => {
    if (museumLoadStatus === "loaded") {
        renderMuseums();
    } else {
        museumFeedback.textContent = marketplaceT(
            museumLoadStatus === "error" ? "home.loadError" : "home.loadingMuseums"
        );
    }
});
loadMuseums();
