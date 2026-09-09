let removeProfileMenuListeners = null;

function getStoredUser() {
    const userKeys = ["artaround_user", "user"];
    for (const key of userKeys) {
        try {
            const user = JSON.parse(localStorage.getItem(key));
            if (user && typeof user === "object") return user;
        } catch (error) {
            // A stale cache must not prevent the shared navigation from rendering.
        }
    }
    return null;
}

function setProfileMenuOpen(toggle, menu, open) {
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
}

function setupMobileProfileMenu() {
    removeProfileMenuListeners?.();

    const toggle = document.getElementById("mobile-profile-toggle");
    const menu = document.getElementById("mobile-profile-menu");
    if (!toggle || !menu) {
        removeProfileMenuListeners = null;
        return;
    }

    const closeMenu = () => setProfileMenuOpen(toggle, menu, false);
    const onToggle = () => {
        setProfileMenuOpen(toggle, menu, menu.hidden);
    };
    const onDocumentClick = (event) => {
        if (!menu.contains(event.target) && !toggle.contains(event.target)) {
            closeMenu();
        }
    };
    const onKeyDown = (event) => {
        if (event.key !== "Escape" || menu.hidden) return;
        closeMenu();
        toggle.focus();
    };

    toggle.addEventListener("click", onToggle);
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    removeProfileMenuListeners = () => {
        toggle.removeEventListener("click", onToggle);
        document.removeEventListener("click", onDocumentClick);
        document.removeEventListener("keydown", onKeyDown);
    };
}

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
    const user = getStoredUser();
    const avatarUrl = user?.avatarUrl || "/uploads/profiles/default-avatar.jpeg";
    const loggedInActions = token ? `
        <ul class="nav-auth nav-auth-desktop">
            <li><a href="user_profile.html"${activePage === "user_profile.html" ? ' class="active" aria-current="page"' : ""}>${marketplaceT("common.account")}</a></li>
            <li><a href="#" id="logout-btn">${marketplaceT("common.logout")}</a></li>
        </ul>
        <div class="nav-profile">
            <button
                type="button"
                id="mobile-profile-toggle"
                class="nav-profile-toggle"
                aria-label="${marketplaceT("nav.profileMenu")}"
                aria-haspopup="true"
                aria-expanded="false"
                aria-controls="mobile-profile-menu"
            >
                <img id="mobile-profile-avatar" class="nav-profile-avatar" alt="" />
            </button>
            <div id="mobile-profile-menu" class="nav-profile-menu" hidden>
                <a href="user_profile.html"${activePage === "user_profile.html" ? ' class="active" aria-current="page"' : ""}>${marketplaceT("common.account")}</a>
                <button type="button" id="mobile-logout-btn">${marketplaceT("common.logout")}</button>
            </div>
        </div>
    ` : `
        <ul class="nav-auth">
            <li><a href="user_profile.html"${activePage === "user_profile.html" ? ' class="active" aria-current="page"' : ""}>${marketplaceT("common.account")}</a></li>
            <li><a href="login.html" id="login-link">${marketplaceT("common.login")}</a></li>
        </ul>
    `;

    wrapper.innerHTML = `
        <a href="homepage.html" class="brand" aria-label="${marketplaceT("nav.homeAria")}">
            <span class="logo-text">A&alpha;</span>
        </a>
        <nav class="nav-main" aria-label="${marketplaceT("nav.primaryAria")}">
            <ul class="nav-links">
                ${links.map(([href, label]) => `
                    <li><a href="${href}"${activePage === href ? ' class="active" aria-current="page"' : ""}>${label}</a></li>
                `).join("")}
            </ul>
        </nav>
        <div class="nav-auth-wrapper">
            ${loggedInActions}
        </div>
    `;

    const avatar = document.getElementById("mobile-profile-avatar");
    if (avatar) {
        avatar.src = avatarUrl;
        avatar.addEventListener("error", () => {
            avatar.src = "/uploads/profiles/default-avatar.jpeg";
        }, { once: true });
    }
    setupMobileProfileMenu();
    document.getElementById("logout-btn")?.addEventListener("click", (event) => {
        event.preventDefault();
        handleLogout();
    });
    document.getElementById("mobile-logout-btn")?.addEventListener("click", handleLogout);
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
