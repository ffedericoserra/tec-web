import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated } from '../auth.js';
import AuthDialog from '../components/AuthDialog.jsx';
import '../styles/home.css';

export default function HomeNoLogin() {
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
        <p className="home-tagline">Visite museali, su misura per te.</p>
      </div>
      <div className="home-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={() => setAuthMode('register')}
        >
          Register
        </button>
        <button
          type="button"
          className="home-link"
          onClick={() => setAuthMode('login')}
        >
          Sign in
        </button>
        <a className="marketplace-link" href="/marketplace">
          Go to marketplace
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
