const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token");

if (!token) {
    alert("Devi effettuare l'accesso per visualizzare questa pagina.");
    window.location.href = "../../marketplace/pages/login.html";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function renderEmptyMessage(message, isError = false) {
    return `<p class="profile-empty-message${isError ? ' error-text' : ''}">${escapeHTML(message)}</p>`;
}

function formatVisitTags(visit, includeLength = true) {
    const tagType = visit.type ? visit.type.charAt(0).toUpperCase() + visit.type.slice(1) : 'Standard';
    const tagLength = visit.length ? visit.length.charAt(0).toUpperCase() + visit.length.slice(1) : 'Normale';
    const tagVisibility = visit.isPublic ? 'Pubblica' : 'Privata';
    const tags = includeLength ? [tagType, tagLength, tagVisibility] : [tagType, tagVisibility];

    return tags.join(' / ');
}

document.addEventListener("DOMContentLoaded", () => {
    async function loadUserVisits() {
        const visitsListContainer = document.getElementById('user-visits-list');

        try {
            const res = await fetch(`${myApi}/visits/my`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                const visits = Array.isArray(data) ? data : (data.visits || []);

                if (visits.length === 0) {
                    visitsListContainer.innerHTML = renderEmptyMessage("Non hai ancora creato nessuna visita.");
                    return;
                }

                visitsListContainer.innerHTML = '';

                visits.forEach((visit) => {
                    const visitItem = document.createElement('article');
                    visitItem.className = 'profile-list-item';

                    const title = escapeHTML(visit.title || 'Visita senza titolo');
                    const tags = escapeHTML(formatVisitTags(visit));
                    const visitId = encodeURIComponent(visit._id || '');

                    visitItem.innerHTML = `
                        <div class="item-info">
                            <span class="profile-item-label">${tags}</span>
                            <h4>${title}</h4>
                        </div>
                        <div class="item-actions">
                            <a href="edit_visit.html?id=${visitId}" class="btn-ghost">Modifica</a>
                        </div>
                    `;

                    visitsListContainer.appendChild(visitItem);
                });
            } else {
                visitsListContainer.innerHTML = renderEmptyMessage("Errore nel caricamento delle visite dal server.", true);
            }
        } catch (err) {
            console.error("Errore durante il recupero delle visite:", err);
            visitsListContainer.innerHTML = renderEmptyMessage("Offline: impossibile connettersi al server per le visite.", true);
        }
    }

    async function loadUserProfile() {
        try {
            const res = await fetch(`${myApi}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                const user = data.user || data;

                document.getElementById('profile-user-name').innerText = user.username || "Utente";
                document.getElementById('profile-wallet-balance').innerText = user.walletBalance || "0";

                const savedTabContainer = document.querySelector('#tab-saved .profile-list');

                if (!user.savedVisits || user.savedVisits.length === 0) {
                    savedTabContainer.innerHTML = renderEmptyMessage("Nessun elemento salvato.");
                } else {
                    savedTabContainer.innerHTML = '';

                    user.savedVisits.forEach((visit) => {
                        const savedItem = document.createElement('article');
                        savedItem.className = 'profile-list-item';

                        const title = escapeHTML(visit.title || 'Visita salvata');
                        const tags = escapeHTML(formatVisitTags(visit, false));
                        const museumId = typeof visit.museumId === 'object' && visit.museumId !== null
                            ? visit.museumId._id
                            : (visit.museumId || '');

                        savedItem.innerHTML = `
                            <div class="item-info">
                                <span class="profile-item-label">${tags}</span>
                                <h4>${title}</h4>
                            </div>
                            <div class="item-actions">
                                <a href="../../marketplace/pages/navigator.html?museumId=${encodeURIComponent(museumId)}&visitId=${encodeURIComponent(visit._id || '')}" class="btn-ghost">Avvia visita</a>
                            </div>
                        `;
                        savedTabContainer.appendChild(savedItem);
                    });
                }

                loadUserVisits();
            } else {
                document.getElementById('profile-user-name').innerText = "Errore nel caricamento";
                document.getElementById('user-visits-list').innerHTML = renderEmptyMessage("Impossibile caricare l'utente e le visite.", true);
            }
        } catch (err) {
            console.error("Errore nel caricamento profilo:", err);
            document.getElementById('profile-user-name').innerText = "Offline";
            document.getElementById('user-visits-list').innerHTML = renderEmptyMessage("Offline: impossibile caricare il profilo.", true);
        }
    }

    loadUserProfile();

    document.querySelectorAll(".tab-btn").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach((content) => {
                content.classList.remove("active");
                content.classList.add("hidden");
            });

            button.classList.add("active");
            const targetId = button.getAttribute("data-target");
            const targetContent = document.getElementById(targetId);

            if (targetContent) {
                targetContent.classList.remove("hidden");
                targetContent.classList.add("active");
            }
        });
    });

    const editProfileBtn = document.querySelector('.profile-actions .btn-primary');

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', async () => {
            const currentUsername = document.getElementById('profile-user-name').innerText;
            let currentEmail = "";

            try {
                const res = await fetch(`${myApi}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    currentEmail = data.user?.email || data.email || "";
                }
            } catch (err) {
                console.error("Errore recupero email", err);
            }

            const overlay = document.createElement("div");
            overlay.className = "modal-overlay profile-modal-overlay";
            overlay.id = "edit-profile-modal";

            const modalContent = document.createElement("div");
            modalContent.className = "modal-content profile-modal-content";

            const editableUsername = currentUsername !== 'Caricamento...' ? currentUsername : '';

            modalContent.innerHTML = `
                <h3 class="modal-profile-title">Impostazioni account</h3>
                <p class="modal-profile-prompt">Modifica le tue credenziali di accesso</p>

                <div class="input-group modal-field">
                    <label class="text-label" for="edit-username-input">Username</label>
                    <input type="text" id="edit-username-input" class="input-minimal" value="${escapeHTML(editableUsername)}">
                </div>

                <div class="input-group modal-field">
                    <label class="text-label" for="edit-email-input">Email</label>
                    <input type="email" id="edit-email-input" class="input-minimal" value="${escapeHTML(currentEmail)}">
                </div>

                <div class="modal-divider"></div>

                <div class="input-group modal-field">
                    <label class="text-label" for="old-password-input">Vecchia password (richiesta per confermare)</label>
                    <input type="password" id="old-password-input" class="input-minimal" placeholder="Password attuale">
                </div>

                <div class="input-group modal-field">
                    <label class="text-label" for="new-password-input">Nuova password (opzionale)</label>
                    <input type="password" id="new-password-input" class="input-minimal" placeholder="Lascia vuoto per non cambiare">
                </div>

                <div class="input-group modal-field">
                    <label class="text-label" for="confirm-password-input">Conferma nuova password</label>
                    <input type="password" id="confirm-password-input" class="input-minimal">
                </div>

                <div class="modal-footer">
                    <button class="cancel-text-btn" id="cancel-edit-btn" type="button">Annulla</button>
                    <button class="btn-primary" id="save-edit-btn" type="button">Salva modifiche</button>
                </div>
            `;

            overlay.appendChild(modalContent);
            document.body.appendChild(overlay);

            document.getElementById('cancel-edit-btn').onclick = () => document.body.removeChild(overlay);

            document.getElementById('save-edit-btn').onclick = async () => {
                const newUsername = document.getElementById('edit-username-input').value.trim();
                const newEmail = document.getElementById('edit-email-input').value.trim();
                const oldPassword = document.getElementById('old-password-input').value;
                const newPassword = document.getElementById('new-password-input').value;
                const confirmPassword = document.getElementById('confirm-password-input').value;

                if (!oldPassword) {
                    alert("Inserisci la vecchia password per confermare le modifiche.");
                    return;
                }

                if (newPassword && newPassword !== confirmPassword) {
                    alert("Le nuove password non coincidono.");
                    return;
                }

                const saveBtn = document.getElementById('save-edit-btn');
                saveBtn.innerText = "Salvataggio...";
                saveBtn.classList.add("is-loading");
                saveBtn.disabled = true;

                const updateData = {
                    username: newUsername,
                    email: newEmail,
                    oldPassword: oldPassword
                };

                if (newPassword) updateData.password = newPassword;

                try {
                    const res = await fetch(`${myApi}/auth/update`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(updateData)
                    });

                    if (res.ok) {
                        alert("Profilo aggiornato con successo.");
                        window.location.reload();
                    } else {
                        const data = await res.json();
                        alert("Errore: " + (data.error || "Impossibile aggiornare i dati."));
                    }
                } catch (err) {
                    alert("Errore di connessione al server.");
                } finally {
                    saveBtn.innerText = "Salva modifiche";
                    saveBtn.classList.remove("is-loading");
                    saveBtn.disabled = false;
                }
            };
        });
    }

    const logoutBtn = document.getElementById('logout-sidebar-btn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            window.location.href = "../../marketplace/pages/login.html";
        });
    }
});
