import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { logout } from '../auth.js';

/**
 * Opened by "or join/create a group visit" on VisitSelect. Two paths behind one
 * dialog, because from the visitor's side they're the same intent — get into a
 * group visit — and which one applies depends only on whether you're the one
 * running it.
 *
 * Create loads the museum's visible visits (GET /museums/:id/visits) and keeps
 * synchronized ones only. Any authenticated user can host a public tour; an
 * author's private synchronized tours remain available only to that author.
 *
 * Follows AuthDialog's contract rather than <dialog>: a state-controlled overlay
 * div, dismissed by backdrop mousedown or Escape.
 */
export default function GroupVisitDialog({ museum, onClose, onJoined }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('join');

  const [code, setCode] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [visits, setVisits] = useState(null);
  const [visitId, setVisitId] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Candidate tours are only needed on the create tab, so they are fetched when
  // it is first opened rather than on mount.
  useEffect(() => {
    if (tab !== 'create' || visits !== null || !museum?._id) return;
    let cancelled = false;
    api(`/museums/${museum._id}/visits`)
      .then((res) => {
        if (cancelled) return;
        const list = (res.visits || []).filter(
          (visit) => visit.type === 'synchronized'
        );
        setVisits(list);
        if (list.length > 0) setVisitId(list[0]._id);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          logout();
          return;
        }
        setVisits([]);
        setError('groupVisit.loadError');
      });
    return () => {
      cancelled = true;
    };
  }, [tab, visits, museum]);

  function switchTab(next) {
    setTab(next);
    setError(null);
  }

  function handleTabKeyDown(event, currentTab) {
    const tabs = ['join', 'create'];
    const currentIndex = tabs.indexOf(currentTab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    switchTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`gv-tab-${nextTab}`)?.focus());
  }

  async function handleJoin(e) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/sessions/${encodeURIComponent(trimmed)}/join`, {
        method: 'POST',
      });
      onJoined(res.session.code);
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setError(
        err.status === 404
          ? 'groupVisit.notFound'
          : 'groupVisit.joinError'
      );
      setBusy(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!visitId) return;
    setBusy(true);
    setError(null);
    try {
      const body = { visitId };
      const custom = customCode.trim();
      if (custom) body.code = custom;
      const res = await api('/sessions', { method: 'POST', body });
      onJoined(res.session.code);
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setError(
        err.status === 409
          ? 'groupVisit.codeConflict'
          : 'groupVisit.createError'
      );
      setBusy(false);
    }
  }

  function backdropDown(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="gv-overlay" onMouseDown={backdropDown}>
      <div
        className="gv-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gv-title"
      >
        <header className="gv-head">
          <h2 id="gv-title">{t('groupVisit.title')}</h2>
          <button
            type="button"
            className="gv-close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ×
          </button>
        </header>

        <div className="gv-tabs" role="tablist" aria-label={t('groupVisit.tabsAria')}>
          <button
            type="button"
            role="tab"
            id="gv-tab-join"
            aria-controls="gv-panel-join"
            aria-selected={tab === 'join'}
            tabIndex={tab === 'join' ? 0 : -1}
            className={`gv-tab${tab === 'join' ? ' is-active' : ''}`}
            onClick={() => switchTab('join')}
            onKeyDown={(event) => handleTabKeyDown(event, 'join')}
          >
            {t('groupVisit.joinTab')}
          </button>
          <button
            type="button"
            role="tab"
            id="gv-tab-create"
            aria-controls="gv-panel-create"
            aria-selected={tab === 'create'}
            tabIndex={tab === 'create' ? 0 : -1}
            className={`gv-tab${tab === 'create' ? ' is-active' : ''}`}
            onClick={() => switchTab('create')}
            onKeyDown={(event) => handleTabKeyDown(event, 'create')}
          >
            {t('groupVisit.createTab')}
          </button>
        </div>

        {tab === 'join' ? (
          <form
            id="gv-panel-join"
            className="gv-body"
            role="tabpanel"
            aria-labelledby="gv-tab-join"
            tabIndex="0"
            onSubmit={handleJoin}
          >
            <label className="gv-label" htmlFor="gv-code">
              {t('groupVisit.sessionCode')}
            </label>
            <input
              id="gv-code"
              className="gv-input gv-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t('groupVisit.codePlaceholder')}
              autoComplete="off"
              autoFocus
            />
            <p className="gv-hint">{t('groupVisit.askGuide')}</p>
            {error && <p className="gv-error" role="alert">{t(error)}</p>}
            <button
              type="submit"
              className="gv-submit"
              disabled={busy || !code.trim()}
            >
              {busy ? t('groupVisit.joining') : t('groupVisit.join')}
            </button>
          </form>
        ) : (
          <form
            id="gv-panel-create"
            className="gv-body"
            role="tabpanel"
            aria-labelledby="gv-tab-create"
            tabIndex="0"
            onSubmit={handleCreate}
          >
            <label className="gv-label" htmlFor="gv-visit">
              {t('groupVisit.yourVisit')}
            </label>
            {visits === null ? (
              <p className="gv-hint" role="status">{t('common.loading')}</p>
            ) : visits.length === 0 ? (
              <p className="gv-hint">
                {t('groupVisit.noVisits')}
              </p>
            ) : (
              <select
                id="gv-visit"
                className="gv-input"
                value={visitId}
                onChange={(e) => setVisitId(e.target.value)}
              >
                {visits.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.title}
                  </option>
                ))}
              </select>
            )}

            <label className="gv-label" htmlFor="gv-custom">
              {t('groupVisit.sessionCode')}{' '}
              <span className="gv-optional">{t('groupVisit.optional')}</span>
            </label>
            <input
              id="gv-custom"
              className="gv-input gv-code-input"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder={t('groupVisit.customCodePlaceholder')}
              autoComplete="off"
            />
            <p className="gv-hint">{t('groupVisit.generatedCode')}</p>
            {error && <p className="gv-error" role="alert">{t(error)}</p>}
            <button
              type="submit"
              className="gv-submit"
              disabled={busy || !visitId}
            >
              {busy ? t('groupVisit.creating') : t('groupVisit.create')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
