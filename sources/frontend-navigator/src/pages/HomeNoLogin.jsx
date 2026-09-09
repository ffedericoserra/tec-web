import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../auth.js';
import AuthDialog from '../components/AuthDialog.jsx';
import '../styles/home.css';

export default function HomeNoLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState(null);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/museums', { replace: true });
    }
  }, [navigate]);

  function handleSuccess() {
    navigate('/museums', { replace: true });
  }

  return (
    <main className="home">
      <div className="home-hero">
        <h1 className="home-title">ArtAround</h1>
        <p className="home-tagline">{t('home.tagline')}</p>
      </div>
      <div className="home-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => setAuthMode('register')}
        >
          {t('home.register')}
        </button>
        <button
          type="button"
          className="home-link"
          onClick={() => setAuthMode('login')}
        >
          {t('home.signIn')}
        </button>
        <a className="marketplace-link" href="/marketplace">
          {t('home.marketplace')}
        </a>
      </div>
      {authMode && (
        <AuthDialog
          initialMode={authMode}
          onClose={() => setAuthMode(null)}
          onSuccess={handleSuccess}
        />
      )}
    </main>
  );
}
