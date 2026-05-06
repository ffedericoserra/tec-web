import { useEffect, useRef, useState } from 'react';
import { logout } from '../auth.js';

export default function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (!ref.current?.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = user?.username?.[0]?.toUpperCase() || '?';

  return (
    <div className="profile" ref={ref}>
      <button
        type="button"
        className="profile-btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Apri menu profilo"
      >
        {initial}
      </button>
      {open && (
        <div className="profile-menu" role="menu">
          <p className="profile-username">{user?.username || 'Utente'}</p>
          {typeof user?.walletBalance === 'number' && (
            <p className="profile-wallet">Saldo: € {user.walletBalance}</p>
          )}
          <button type="button" className="profile-logout" onClick={logout}>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
