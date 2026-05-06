import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getCachedUser, setCachedUser } from '../api.js';
import { isAuthenticated, logout } from '../auth.js';
import PageHeader from '../components/PageHeader.jsx';
import ProfileMenu from '../components/ProfileMenu.jsx';
import '../styles/visitSelect.css';

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Chevron() {
  return (
    <svg
      className="chevron"
      viewBox="0 0 16 16"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        d="M3 6 L8 11 L13 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function VisitSelect() {
  const { museumSlug } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(getCachedUser());
  const [museum, setMuseum] = useState(null);
  const [visits, setVisits] = useState([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api('/auth/me'),
      api(`/museums/${museumSlug}`),
      api(`/museums/${museumSlug}/visits`),
    ])
      .then(([meRes, musRes, visRes]) => {
        if (cancelled) return;
        setUser(meRes.user);
        setCachedUser(meRes.user);
        setMuseum(musRes.museum);
        setVisits(visRes.visits || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          logout();
          return;
        }
        if (err.status === 404) {
          navigate('/museums', { replace: true });
          return;
        }
        setError(err.message || 'Impossibile caricare le visite');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [museumSlug, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visits;
    return visits.filter((v) => (v.title || '').toLowerCase().includes(q));
  }, [visits, query]);

  function toggleExpand(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="page-visit-select">
      <PageHeader
        subtitle={museum?.name}
        right={<ProfileMenu user={user} />}
      />
      <main className="page-visit-select-body">
        <h1 className="page-visit-select-title">
          What kind of visit are you looking for?
        </h1>
        <input
          type="search"
          className="search-input"
          placeholder="Search for a visit..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Cerca visita"
        />
        <button
          type="button"
          className="group-visit-link"
          onClick={(e) => e.preventDefault()}
          title="Coming soon"
          aria-disabled="true"
        >
          or join/create a group visit
        </button>
        {loading && <p className="status">Caricamento…</p>}
        {error && !loading && <p className="status error">{error}</p>}
        {!loading && !error && (
          <ul className="visit-list">
            {filtered.map((v) => {
              const isOpen = expanded.has(v._id);
              const hasDesc = !!(v.description && v.description.trim());
              return (
                <li key={v._id}>
                  <article
                    className={`visit-card${isOpen ? ' is-expanded' : ''}`}
                  >
                    <div className="visit-card-head">
                      <div className="visit-card-info">
                        <h2 className="visit-card-title">{v.title}</h2>
                        <p className="visit-card-meta">
                          Author: {v.creatorId?.username || '—'}
                        </p>
                        <p className="visit-card-meta">
                          Length: {capitalize(v.length) || '—'}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="start-visit-btn"
                        onClick={() => navigate(`/${museumSlug}/${v.slug}`)}
                      >
                        Start Visit
                      </button>
                    </div>
                    {isOpen && hasDesc && (
                      <div className="visit-card-desc">
                        <p>{v.description}</p>
                      </div>
                    )}
                    {hasDesc && (
                      <button
                        type="button"
                        className="visit-card-toggle"
                        onClick={() => toggleExpand(v._id)}
                        aria-expanded={isOpen}
                        aria-label={
                          isOpen ? 'Nascondi descrizione' : 'Mostra descrizione'
                        }
                      >
                        <Chevron />
                      </button>
                    )}
                  </article>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="empty">
                {visits.length === 0
                  ? 'Nessuna visita disponibile.'
                  : 'Nessuna visita trovata.'}
              </li>
            )}
          </ul>
        )}
      </main>
    </div>
  );
}
