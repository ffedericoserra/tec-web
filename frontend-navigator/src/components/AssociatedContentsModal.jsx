import { useEffect } from 'react';

/* Detail rows for one Content, in the order the spec asks for:
 * Author / Title / Year / Content Type, then Universal ID below a divider. */
function ContentDetails({ content }) {
  const rows = [
    { label: 'Author', value: content.author },
    { label: 'Title', value: content.name },
    { label: 'Year', value: content.year },
    { label: 'Content Type', value: content.type },
  ];

  return (
    <dl className="assoc-details">
      {rows.map((r) => (
        <div className="assoc-detail-row" key={r.label}>
          <dt>{r.label}:</dt>
          <dd>{r.value || '—'}</dd>
        </div>
      ))}
      <div className="assoc-detail-row is-separated">
        <dt>Universal ID:</dt>
        <dd>{content.universalId || '—'}</dd>
      </div>
    </dl>
  );
}

export default function AssociatedContentsModal({
  content,
  item,
  loading,
  error,
  onClose,
}) {
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

  // Other Contents linked to this item. Only populated by GET /items/:id, hence
  // the lazy fetch in VisitRun — the visit fetch doesn't include them.
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
          <h2 id="assoc-title">Dettagli contenuto</h2>
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
          {/* The current content comes from the visit fetch, so it renders
              immediately — it doesn't wait on the associated-contents request. */}
          {content ? (
            <ContentDetails content={content} />
          ) : (
            <p className="assoc-empty">Nessun dettaglio disponibile.</p>
          )}

          {loading && <p className="assoc-empty">Caricamento…</p>}
          {error && !loading && <p className="assoc-empty">{error}</p>}

          {!loading && !error && list.length > 0 && (
            <section className="assoc-related">
              <h3 className="assoc-related-title">Contenuti associati</h3>
              <ul className="assoc-list">
                {list.map((c) => (
                  <li key={c._id}>
                    <ContentDetails content={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
