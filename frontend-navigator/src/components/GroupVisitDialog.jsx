import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { logout } from '../auth.js';

/**
 * Opened by "or join/create a group visit" on VisitSelect. Two paths behind one
 * dialog, because from the visitor's side they're the same intent — get into a
 * group visit — and which one applies depends only on whether you're the one
 * running it.
 *
 * Create lists the user's *own* visits (GET /visits/my), not the museum's public
 * ones: a session is run by the person who authored the tour, and the seeded
 * didactic visits are deliberately private so they never appear in the public
 * list VisitSelect shows.
 *
 * Follows AuthDialog's contract rather than <dialog>: a state-controlled overlay
 * div, dismissed by backdrop mousedown or Escape.
 */
export default function GroupVisitDialog({ museum, onClose, onJoined }) {
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

  // Own visits are only needed on the create tab, so they're fetched when it's
  // first opened rather than on mount.
  useEffect(() => {
    if (tab !== 'create' || visits !== null || !museum?._id) return;
    let cancelled = false;
    api(`/visits/my?museumId=${museum._id}`)
      .then((res) => {
        if (cancelled) return;
        const list = res.visits || [];
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
        setError(err.message || 'Impossibile caricare le tue visite');
      });
    return () => {
      cancelled = true;
    };
  }, [tab, visits, museum]);

  function switchTab(next) {
    setTab(next);
    setError(null);
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
          ? 'Nessuna sessione attiva con questo codice.'
          : err.message || 'Impossibile entrare nella sessione'
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
          ? 'Questo codice è già in uso. Scegline un altro.'
          : err.message || 'Impossibile creare la sessione'
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
          <h2 id="gv-title">Group visit</h2>
          <button
            type="button"
            className="gv-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </header>

        <div className="gv-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'join'}
            className={`gv-tab${tab === 'join' ? ' is-active' : ''}`}
            onClick={() => switchTab('join')}
          >
            Join
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'create'}
            className={`gv-tab${tab === 'create' ? ' is-active' : ''}`}
            onClick={() => switchTab('create')}
          >
            Create
          </button>
        </div>

        {tab === 'join' ? (
          <form className="gv-body" onSubmit={handleJoin}>
            <label className="gv-label" htmlFor="gv-code">
              Session code
            </label>
            <input
              id="gv-code"
              className="gv-input gv-code-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ROSSO_LEONE_12"
              autoComplete="off"
              autoFocus
            />
            <p className="gv-hint">Ask your guide for the code.</p>
            {error && <p className="gv-error">{error}</p>}
            <button
              type="submit"
              className="gv-submit"
              disabled={busy || !code.trim()}
            >
              {busy ? 'Joining…' : 'Join visit'}
            </button>
          </form>
        ) : (
          <form className="gv-body" onSubmit={handleCreate}>
            <label className="gv-label" htmlFor="gv-visit">
              Your visit
            </label>
            {visits === null ? (
              <p className="gv-hint">Caricamento…</p>
            ) : visits.length === 0 ? (
              <p className="gv-hint">
                You have no visits for this museum yet. Create one in the
                Marketplace first.
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
              Session code <span className="gv-optional">(optional)</span>
            </label>
            <input
              id="gv-custom"
              className="gv-input gv-code-input"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="CLASSE_3B"
              autoComplete="off"
            />
            <p className="gv-hint">Leave empty for a generated code.</p>
            {error && <p className="gv-error">{error}</p>}
            <button
              type="submit"
              className="gv-submit"
              disabled={busy || !visitId}
            >
              {busy ? 'Creating…' : 'Create visit'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
