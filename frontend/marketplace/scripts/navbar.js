function renderMarketplaceNavbar() {
    const token = localStorage.getItem("token") || localStorage.getItem("artaround_token");
    const wrapper = document.querySelector(".editorial-nav .nav-wrapper");
    if (!wrapper) return;

    const page = window.location.pathname.split("/").pop();
    const activePage = page === "create_visits.html" ? "visits_list.html"
        : page === "create_items.html" ? "my_items.html"
            : page;
    const links = [
        ["visits_list.html", marketplaceT("nav.myVisits")],
        ["my_items.html", marketplaceT("nav.myItems")],
        ["about.html", marketplaceT("nav.about")],
        ["/frontend-navigator/dist/index.html", marketplaceT("common.navigator")]
    ];

    wrapper.innerHTML = `
        <a href="homepage.html" class="brand" aria-label="${marketplaceT("nav.homeAria")}">
            <span class="logo-text">A&alpha;</span>
        </a>
        <ul class="nav-links">
            ${links.map(([href, label]) => `
                <li><a href="${href}"${activePage === href ? ' class="active"' : ""}>${label}</a></li>
            `).join("")}
        </ul>
        <div class="nav-auth-wrapper">
            <ul class="nav-auth">
                <li><a href="user_profile.html"${activePage === "user_profile.html" ? ' class="active"' : ""}>${marketplaceT("common.account")}</a></li>
                <li><a href="${token ? "#" : "login.html"}" id="${token ? "logout-btn" : "login-link"}">${token ? marketplaceT("common.logout") : marketplaceT("common.login")}</a></li>
            </ul>
        </div>
    `;

    document.getElementById("logout-btn")?.addEventListener("click", (event) => {
        event.preventDefault();
        clearAuth();
        window.location.href = "homepage.html";
    });
}

document.addEventListener("DOMContentLoaded", renderMarketplaceNavbar);
window.addEventListener("marketplace:language-changed", renderMarketplaceNavbar);

function clearAuth() {
    localStorage.removeItem("token");
    localStorage.removeItem("artaround_token");
    localStorage.removeItem("artaround_user");
    localStorage.removeItem("user");
}

function handleLogout() {
    clearAuth();
    window.location.href = "homepage.html";
}
