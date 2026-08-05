import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getCachedUser, setCachedUser } from '../api.js';
import { isAuthenticated, logout } from '../auth.js';
import PageHeader from '../components/PageHeader.jsx';
import ProfileMenu from '../components/ProfileMenu.jsx';
import GroupVisitDialog from '../components/GroupVisitDialog.jsx';
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
  const [contents, setContents] = useState({});
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupOpen, setGroupOpen] = useState(false);

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
      api(`/museums/${museumSlug}/contents`),
    ])
      .then(([meRes, musRes, visRes, contRes]) => {
        if (cancelled) return;
        setUser(meRes.user);
        setCachedUser(meRes.user);
        setMuseum(musRes.museum);
        setVisits(visRes.visits || []);
        // item.contentId is the Content's universalId string, not an ObjectId,
        // so the stop names can't come from populate — same map as VisitRun.
        const byUid = {};
        (contRes.contents || []).forEach((c) => {
          if (c.universalId) byUid[c.universalId] = c;
        });
        setContents(byUid);
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
        brandTo="/museums"
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
          onClick={() => setGroupOpen(true)}
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
              const stops = (v.sequence || []).map(
                (entry) => contents[entry.itemId?.contentId] || null
              );
              const hasStops = stops.length > 0;
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
                    {isOpen && hasStops && (
                      <div className="visit-card-stops">
                        <h3 className="visit-card-stops-title">
                          {stops.length} stops
                        </h3>
                        <ol className="visit-card-stop-list">
                          {stops.map((c, i) => (
                            <li key={i} className="visit-card-stop">
                              <span className="visit-card-stop-num">
                                {i + 1}
                              </span>
                              <span className="visit-card-stop-name">
                                {c?.name || 'Contenuto non disponibile'}
                              </span>
                              <span className="visit-card-stop-type">
                                {c?.type || '—'}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {(hasDesc || hasStops) && (
                      <button
                        type="button"
                        className="visit-card-toggle"
                        onClick={() => toggleExpand(v._id)}
                        aria-expanded={isOpen}
                        aria-label={
                          isOpen ? 'Nascondi dettagli' : 'Mostra dettagli'
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

      {groupOpen && (
        <GroupVisitDialog
          museum={museum}
          onClose={() => setGroupOpen(false)}
          onJoined={(code) => navigate(`/session/${code}`)}
        />
      )}
    </div>
  );
}
