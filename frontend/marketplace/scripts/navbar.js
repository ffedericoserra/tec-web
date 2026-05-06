document.addEventListener('DOMContentLoaded', () => {
    // 1. Controlliamo se l'utente ha il token di accesso
    const token = localStorage.getItem("token");
    
    // Selezioniamo i gruppi di link
    const guestLinks = document.querySelectorAll('.guest-only');
    const userLinks = document.querySelectorAll('.user-only');

    // 2. LOGICA DI SCAMBIO VISUALIZZAZIONE
    if (token) {
        // Utente LOGGATO: Nascondiamo Login/Sign-up, Mostriamo Account/Logout
        guestLinks.forEach(link => link.classList.add('hidden'));
        userLinks.forEach(link => link.classList.remove('hidden'));
    } else {
        // Utente SLOGGATO: Mostriamo Login/Sign-up, Nascondiamo Account/Logout
        guestLinks.forEach(link => link.classList.remove('hidden'));
        userLinks.forEach(link => link.classList.add('hidden'));
    }

    // 3. GESTIONE DEL TASTO "LOG OUT"
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem("token"); // Cancelliamo il passaporto
            window.location.href = "homepage.html"; // Lo rimandiamo alla home pubblica
        });
    }

    // 4. PROTEZIONE "ADD A MUSEUM"
    const addMuseumBtn = document.getElementById('nav-add-museum');
    if (addMuseumBtn) {
        addMuseumBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (!token) {
                alert("È necessario effettuare il login per aggiungere un museo.");
                window.location.href = "login.html";
            } else {
                // SE E' LOGGATO: Qui decidi cosa fare. 
                // Se usi un modale, rimuovi la classe hidden al modale:
                // document.getElementById('add-museum-modal').classList.remove('hidden');
                
                // Se usi una pagina dedicata (come sembra dallo schema):
                window.location.href = "add_museum.html"; 
            }
        });
    }
});

function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
}
