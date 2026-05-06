import { useEffect } from 'react';

export default function AssociatedContentsModal({ item, loading, error, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function backdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  const list = item?.associatedContents || [];

  return (
    <div className="assoc-overlay" onMouseDown={backdropClick}>
      <div
        className="assoc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assoc-title"
      >
        <header className="assoc-head">
          <h2 id="assoc-title">Contenuti associati</h2>
          <button
            type="button"
            className="assoc-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </header>
        <div className="assoc-body">
          {loading && <p className="assoc-empty">Caricamento…</p>}
          {error && !loading && <p className="assoc-empty">{error}</p>}
          {!loading && !error && list.length === 0 && (
            <p className="assoc-empty">Nessun contenuto associato.</p>
          )}
          {!loading && !error && list.length > 0 && (
            <ul className="assoc-list">
              {list.map((c) => (
                <li key={c._id}>
                  <article className="assoc-card">
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt={c.name}
                        className="assoc-card-img"
                      />
                    ) : (
                      <div className="assoc-card-img is-placeholder">
                        {c.type || 'Content'}
                      </div>
                    )}
                    <div className="assoc-card-body">
                      <p className="assoc-card-type">{c.type}</p>
                      <h3 className="assoc-card-name">{c.name}</h3>
                      {c.author && (
                        <p className="assoc-card-meta">{c.author}</p>
                      )}
                      {c.year && <p className="assoc-card-meta">{c.year}</p>}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
