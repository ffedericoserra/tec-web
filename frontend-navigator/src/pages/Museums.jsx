import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api, getCachedUser, setCachedUser } from '../api.js';
import { isAuthenticated, logout } from '../auth.js';
import PageHeader from '../components/PageHeader.jsx';
import ProfileMenu from '../components/ProfileMenu.jsx';
import { localeForLanguage } from '../i18n.js';
import '../styles/museums.css';

export default function Museums() {
  const { t, i18n } = useTranslation();
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
        setError('museums.loadError');
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
    const locale = localeForLanguage(i18n.resolvedLanguage);
    return list.sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', locale)
    );
  }, [museums, query, i18n.resolvedLanguage]);

  return (
    <div className="page-museums">
      <PageHeader right={<ProfileMenu user={user} />} />
      <main className="page-museums-body">
        <span className="kicker">{t('museums.kicker')}</span>
        <h1 className="page-museums-title">{t('museums.title')}</h1>
        <label className="search-field">
          <span className="search-label">{t('museums.searchLabel')}</span>
          <input
            type="search"
            className="search-input"
            placeholder={t('museums.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('museums.searchAria')}
          />
        </label>
        {loading && <p className="status">{t('common.loading')}</p>}
        {error && !loading && <p className="status error">{t(error)}</p>}
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
                  ? t('museums.empty')
                  : t('museums.notFound')}
              </li>
            )}
          </ul>
        )}
        {/* Plain <a>, not a Link: the marketplace is served by Express, not
         * the SPA router, so it needs a real page load. */}
        <a className="marketplace-link is-footer" href="/marketplace">
          {t('home.marketplace')}
        </a>
      </main>
    </div>
  );
}
