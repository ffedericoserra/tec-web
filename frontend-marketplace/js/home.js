import { api, setToken, setCachedUser } from './api.js';
import { isAuthenticated } from './auth.js';

if (isAuthenticated()) {
  window.location.replace('/marketplace-fede-old/museums');
} else {
  initLogin();
}

function initLogin() {
  const dialog = document.getElementById('loginDialog');
  const openBtn = document.getElementById('loginBtn');
  const cancelBtn = document.getElementById('loginCancel');
  const form = document.getElementById('loginForm');
  const submitBtn = document.getElementById('loginSubmit');
  const errorEl = document.getElementById('loginError');

  openBtn.addEventListener('click', () => {
    errorEl.textContent = '';
    form.reset();
    dialog.showModal();
    form.querySelector('input[name="username"]').focus();
  });

  cancelBtn.addEventListener('click', () => dialog.close());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const data = new FormData(form);
    const payload = {
      username: data.get('username').trim(),
      password: data.get('password'),
    };

    submitBtn.disabled = true;
    try {
      const { token, user } = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setToken(token);
      setCachedUser(user);
      window.location.replace('/marketplace-fede-old/museums');
    } catch (err) {
      errorEl.textContent = err.status === 401 ? 'Invalid username or password.' : err.message;
      submitBtn.disabled = false;
    }
  });
}
