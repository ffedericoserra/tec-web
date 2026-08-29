import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getCachedUser, setCachedUser } from '../api.js';
import { isAuthenticated, logout } from '../auth.js';
import PageHeader from '../components/PageHeader.jsx';
import ProfileMenu from '../components/ProfileMenu.jsx';
import GroupVisitDialog from '../components/GroupVisitDialog.jsx';
import '../styles/visitSelect.css';

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

function VisitImageCarousel({ images, visitTitle, t }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const currentIndex = Math.min(activeIndex, images.length - 1);
  const current = images[currentIndex];

  if (!current) return null;

  function showPrevious() {
    setActiveIndex((index) => (index - 1 + images.length) % images.length);
  }

  function showNext() {
    setActiveIndex((index) => (index + 1) % images.length);
  }

  return (
    <section
      className="visit-card-carousel"
      aria-label={t('visitSelect.carouselAria', { title: visitTitle })}
    >
      <img
        className="visit-card-carousel-image"
        src={current.imageUrl}
        alt={t('visitSelect.artworkImageAlt', { name: current.name })}
      />
      <p className="visit-card-carousel-caption">{current.name}</p>
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="visit-card-carousel-control is-previous"
            onClick={showPrevious}
            aria-label={t('visitSelect.previousImage')}
          >
            &lsaquo;
          </button>
          <button
            type="button"
            className="visit-card-carousel-control is-next"
            onClick={showNext}
            aria-label={t('visitSelect.nextImage')}
          >
            &rsaquo;
          </button>
        </>
      )}
      <span className="visit-card-carousel-count" aria-live="polite">
        {t('visitSelect.imagePosition', {
          current: currentIndex + 1,
          total: images.length,
        })}
      </span>
    </section>
  );
}

export default function VisitSelect() {
  const { t } = useTranslation();
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
        setError('visitSelect.loadError');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [museumSlug, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function refreshVisits() {
      try {
        const res = await api(`/museums/${museumSlug}/visits`);
        if (!cancelled) setVisits(res.visits || []);
      } catch (err) {
        if (!cancelled && err.status !== 401) {
          setError('visitSelect.refreshError');
        }
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') refreshVisits();
    }

    window.addEventListener('focus', refreshVisits);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshVisits);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [museumSlug]);

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
        <span className="kicker">{museum?.name || t('common.museum')}</span>
        <h1 className="page-visit-select-title">
          {t('visitSelect.title')}
        </h1>
        <label className="search-field">
          <span className="search-label">{t('visitSelect.searchLabel')}</span>
          <input
            type="search"
            className="search-input"
            placeholder={t('visitSelect.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('visitSelect.searchAria')}
          />
        </label>
        <button
          type="button"
          className="group-visit-link"
          onClick={() => setGroupOpen(true)}
        >
          {t('visitSelect.groupAction')}
        </button>
        {loading && <p className="status">{t('common.loading')}</p>}
        {error && !loading && <p className="status error">{t(error)}</p>}
        {!loading && !error && (
          <ul className="visit-list">
            {filtered.map((v) => {
              const isOpen = expanded.has(v._id);
              const hasDesc = !!(v.description && v.description.trim());
              const stops = (v.sequence || []).map(
                (entry) => contents[entry.itemId?.contentId] || null
              );
              const hasStops = stops.length > 0;
              const imageStops = stops.filter((stop) => stop?.imageUrl);
              return (
                <li key={v._id}>
                  <article
                    className={`visit-card${isOpen ? ' is-expanded' : ''}`}
                  >
                    <div className="visit-card-head">
                      <div className="visit-card-info">
                        <h2 className="visit-card-title">{v.title}</h2>
                        <p className="visit-card-meta">
                          {t('visitSelect.author', {
                            author: v.creatorId?.username || '—',
                          })}
                        </p>
                        <p className="visit-card-meta">
                          {t('visitSelect.length', {
                            length: v.length
                              ? t(`visitMeta.length.${v.length}`, {
                                  defaultValue: v.length,
                                })
                              : '—',
                          })}
                        </p>
                        {v.isPublic === false && (
                          <p className="visit-card-meta">
                            {t('visitSelect.visibilityPrivate')}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="start-visit-btn"
                        onClick={() => navigate(`/${museumSlug}/${v.slug}`)}
                      >
                        {t('visitSelect.start')}
                      </button>
                    </div>
                    {isOpen && (hasDesc || hasStops) && (
                      <div className="visit-card-expanded-content">
                    {hasDesc && (
                      <div className="visit-card-desc">
                        <p>{v.description}</p>
                      </div>
                    )}
                    {hasStops && (
                      <div
                        className={`visit-card-explore${
                          imageStops.length ? ' has-carousel' : ''
                        }`}
                      >
                        <div className="visit-card-stops">
                        <h3 className="visit-card-stops-title">
                          {t('visitSelect.stops', { count: stops.length })}
                        </h3>
                        <ol className="visit-card-stop-list">
                          {stops.map((c, i) => (
                            <li key={i} className="visit-card-stop">
                              <span className="visit-card-stop-num">
                                {i + 1}
                              </span>
                              <span className="visit-card-stop-name">
                                {c?.name || t('visitSelect.contentUnavailable')}
                              </span>
                              <span className="visit-card-stop-type">
                                {c?.type
                                  ? t(`contentType.${c.type}`, {
                                      defaultValue: c.type,
                                    })
                                  : '—'}
                              </span>
                            </li>
                          ))}
                        </ol>
                        </div>
                        <VisitImageCarousel
                          images={imageStops}
                          visitTitle={v.title}
                          t={t}
                        />
                      </div>
                    )}
                      </div>
                    )}
                    {(hasDesc || hasStops) && (
                      <button
                        type="button"
                        className="visit-card-toggle"
                        onClick={() => toggleExpand(v._id)}
                        aria-expanded={isOpen}
                        aria-label={
                          isOpen
                            ? t('visitSelect.hideDetails')
                            : t('visitSelect.showDetails')
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
                  ? t('visitSelect.empty')
                  : t('visitSelect.notFound')}
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
