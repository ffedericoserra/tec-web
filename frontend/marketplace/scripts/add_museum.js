const isLocal = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1');
const baseUrl = isLocal ? 'http://localhost:8000' : window.location.origin;
const myApi = `${baseUrl}/api`;
const token = localStorage.getItem("token");

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-museum-form');

    if (!token) {
        alert("You must be logged in to access this page.");
        window.location.href = "../pages/login.html";
        return;
    }

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const hoursInputs = document.querySelectorAll('.hours-row input');
        const payload = {
            name: document.getElementById('m-name').value.trim(),
            address: document.getElementById('m-address').value.trim(),
            description: document.getElementById('m-description').value.trim(),
            website: document.getElementById('m-website').value.trim(),
            email: document.getElementById('m-email').value.trim(),
            phone: document.getElementById('m-phone').value.trim(),
            imageUrl: document.getElementById('m-image').value.trim(),

            openingHours: {
                mon: hoursInputs[0]?.value.trim() || undefined,
                tue: hoursInputs[1]?.value.trim() || undefined,
                wed: hoursInputs[2]?.value.trim() || undefined,
                thu: hoursInputs[3]?.value.trim() || undefined,
                fri: hoursInputs[4]?.value.trim() || undefined,
                sat: hoursInputs[5]?.value.trim() || undefined,
                sun: hoursInputs[6]?.value.trim() || undefined,
            },

            theme: {
                primaryColor: document.getElementById('m-primary-color').value,
                secondaryColor: document.getElementById('m-secondary-color').value,
                font: document.getElementById('m-font').value
            },

            mapData: {
                imageUrl: document.getElementById('m-map-image').value.trim() || undefined
            }
        };

        Object.keys(payload).forEach((key) => {
            if (payload[key] === "") {
                delete payload[key];
            }
        });

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerText;
        submitBtn.innerText = "Salvataggio in corso...";
        submitBtn.classList.add("is-loading");
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${myApi}/museums`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                alert("Museo aggiunto con successo!");
                window.location.href = "../pages/homepage.html";
            } else {
                alert("Errore durante il salvataggio: " + (data.error || "Controlla i campi inseriti."));
            }
        } catch (error) {
            console.error("Errore fetch:", error);
            alert("Si e' verificato un errore di connessione al server.");
        } finally {
            submitBtn.innerText = originalBtnText;
            submitBtn.classList.remove("is-loading");
            submitBtn.disabled = false;
        }
    });
});
