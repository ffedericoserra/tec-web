import { useNavigate } from 'react-router-dom';
import '../styles/header.css';

export default function PageHeader({ subtitle, right }) {
  const navigate = useNavigate();

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/');
  }

  return (
    <header className="page-header">
      <nav className="page-header-navigation" aria-label="Navigazione principale">
        <button
          type="button"
          className="page-header-back"
          onClick={goBack}
          aria-label="Torna indietro"
          title="Torna indietro"
        >
          <span aria-hidden="true">←</span>
        </button>
        <a className="page-header-marketplace" href="/marketplace">
          Marketplace
        </a>
      </nav>
      <div className="page-header-brand">
        <span>ArtAround</span>
        {subtitle && (
          <>
            <span className="brand-sep">|</span>
            <span className="brand-sub">{subtitle}</span>
          </>
        )}
      </div>
      {right && <div className="page-header-right">{right}</div>}
    </header>
  );
}
