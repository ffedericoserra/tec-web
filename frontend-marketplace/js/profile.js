import { logout } from './auth.js';

/**
 * Wires the standard profile-circle component used in the top-right of every
 * authenticated page. The page must include the standard markup with IDs:
 * profileBtn, profileMenu, profileAvatar, profileUsername, logoutBtn.
 */
export function mountProfile(user) {
  const btn = document.getElementById('profileBtn');
  const menu = document.getElementById('profileMenu');
  const avatar = document.getElementById('profileAvatar');
  const username = document.getElementById('profileUsername');
  const logoutBtn = document.getElementById('logoutBtn');

  username.textContent = user.username;
  avatar.textContent = (user.username[0] || '?').toUpperCase();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  });

  logoutBtn.addEventListener('click', () => logout());
}
