document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem("token");
    const navAuth = document.querySelector('.nav-auth');
    if (token && navAuth) {
        // Se loggato, nasconde login/sign-up e mostra logout
        const loginLink = navAuth.querySelector('a[href="login.html"]');
        const signupLink = navAuth.querySelector('a[href="register.html"]');
        if (loginLink) loginLink.parentElement.classList.add('hidden');
        if (signupLink) signupLink.parentElement.classList.add('hidden');
        const logoutItem = document.getElementById('logout-item');
        if (logoutItem) logoutItem.classList.remove('hidden');
    }
});

function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
}