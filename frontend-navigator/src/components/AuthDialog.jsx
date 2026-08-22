import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, setToken, setCachedUser } from '../api.js';
import { currentLanguage } from '../i18n.js';

export default function AuthDialog({ initialMode = 'login', onClose, onSuccess }) {
  const { t } = useTranslation();
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
      const registrationLanguage = currentLanguage();
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
      let authenticatedUser = data.user;

      if (mode === 'register' && data.user?.language !== registrationLanguage) {
        try {
          const languageResponse = await api('/auth/language', {
            method: 'PATCH',
            body: { language: registrationLanguage },
          });
          authenticatedUser = {
            ...data.user,
            language:
              languageResponse.user?.language ||
              languageResponse.language ||
              registrationLanguage,
          };
        } catch {
          // Registration succeeded; keep the server's default language if this
          // secondary preference update fails.
        }
      }

      setCachedUser(authenticatedUser);
      onSuccess(authenticatedUser);
    } catch (err) {
      setError(
        err.status === 401
          ? 'auth.invalidCredentials'
          : err.status === 409
            ? 'auth.accountExists'
            : 'auth.genericError'
      );
      setSubmitting(false);
    }
  }

  function backdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const heading = mode === 'register' ? t('auth.registerTitle') : t('auth.loginTitle');
  const submitLabel = mode === 'register' ? t('auth.submitRegister') : t('auth.submitLogin');

  return (
    <div className="auth-overlay" onMouseDown={backdropClick}>
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <h2 id="auth-title">{heading}</h2>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <label>
            {t('auth.username')}
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
              {t('auth.email')}
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
            {t('auth.password')}
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
              {t(error)}
            </p>
          )}
          <div className="auth-actions">
            <button type="button" className="auth-cancel" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? '…' : submitLabel}
            </button>
          </div>
        </form>
        <p className="auth-switch">
          {mode === 'register' ? t('auth.hasAccount') : t('auth.noAccount')}{' '}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode(mode === 'register' ? 'login' : 'register');
            }}
          >
            {mode === 'register' ? t('auth.submitLogin') : t('auth.submitRegister')}
          </button>
        </p>
      </div>
    </div>
  );
}
