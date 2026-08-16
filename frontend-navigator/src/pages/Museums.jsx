import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCachedUser, setCachedUser } from '../api.js';
import { isAuthenticated, logout } from '../auth.js';
import PageHeader from '../components/PageHeader.jsx';
import ProfileMenu from '../components/ProfileMenu.jsx';
import '../styles/museums.css';

export default function Museums() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCachedUser());
  const [museums, setMuseums] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    Promise.all([api('/auth/me'), api('/museums')])
      .then(([meRes, musRes]) => {
        if (cancelled) return;
        setUser(meRes.user);
        setCachedUser(meRes.user);
        setMuseums(musRes.museums || []);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          logout();
          return;
        }
        setError(err.message || 'Impossibile caricare i musei');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? museums.filter((m) => (m.name || '').toLowerCase().includes(q))
      : [...museums];
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [museums, query]);

  return (
    <div className="page-museums">
      <PageHeader right={<ProfileMenu user={user} />} />
      <main className="page-museums-body">
        <span className="kicker">ArtAround Navigator</span>
        <h1 className="page-museums-title">Select a Museum</h1>
        <label className="search-field">
          <span className="search-label">Search</span>
          <input
            type="search"
            className="search-input"
            placeholder="Search a museum…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Cerca museo"
          />
        </label>
        {loading && <p className="status">Caricamento…</p>}
        {error && !loading && <p className="status error">{error}</p>}
        {!loading && !error && (
          <ul className="museum-list">
            {filtered.map((m) => (
              <li key={m._id || m.slug}>
                <button
                  type="button"
                  className="museum-row"
                  onClick={() => navigate(`/${m.slug}`)}
                >
                  <span>{m.name}</span>
                  <span className="museum-row-arrow" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="empty">
                {museums.length === 0
                  ? 'Nessun museo disponibile.'
                  : 'Nessun museo trovato.'}
              </li>
            )}
          </ul>
        )}
        {/* Plain <a>, not a Link: the marketplace is served by Express, not
         * the SPA router, so it needs a real page load. */}
        <a className="marketplace-link is-footer" href="/marketplace">
          Go to marketplace
        </a>
      </main>
    </div>
  );
}
