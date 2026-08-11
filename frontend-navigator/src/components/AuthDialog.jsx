import { useEffect, useRef, useState } from 'react';
import { api, setToken, setCachedUser } from '../api.js';

export default function AuthDialog({ initialMode = 'login', onClose, onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const usernameRef = useRef(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        username: username.trim(),
        password,
      };

      if (mode === 'register') {
        body.email = email.trim();
      }

      const data = await api(`/auth/${mode}`, {
        method: 'POST',
        body,
      });
      setToken(data.token);
      setCachedUser(data.user);
      onSuccess(data.user);
    } catch (err) {
      const detail = err.data?.details?.[0]?.message;
      setError(detail || err.data?.message || err.message || 'Something went wrong');
      setSubmitting(false);
    }
  }

  function backdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const heading = mode === 'register' ? 'Crea il tuo account' : 'Bentornato';
  const submitLabel = mode === 'register' ? 'Registrati' : 'Accedi';

  return (
    <div className="auth-overlay" onMouseDown={backdropClick}>
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h2 id="auth-title">{heading}</h2>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label>
            Nome utente
            <input
              ref={usernameRef}
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              minLength={3}
              required
            />
          </label>
          {mode === 'register' && (
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <div className="auth-actions">
            <button type="button" className="auth-cancel" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? '…' : submitLabel}
            </button>
          </div>
        </form>
        <p className="auth-switch">
          {mode === 'register' ? 'Hai già un account?' : 'Non hai un account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode(mode === 'register' ? 'login' : 'register');
            }}
          >
            {mode === 'register' ? 'Accedi' : 'Registrati'}
          </button>
        </p>
      </div>
    </div>
  );
}
