import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/* Detail rows for one Content, in the order the spec asks for:
 * Author / Title / Year / Content Type, then Universal ID below a divider. */
function ContentDetails({ content }) {
  const { t } = useTranslation();
  const rows = [
    { label: t('associated.author'), value: content.author },
    { label: t('associated.contentTitle'), value: content.name },
    { label: t('associated.year'), value: content.year },
    {
      label: t('associated.contentType'),
      value: content.type
        ? t(`contentType.${content.type}`, { defaultValue: content.type })
        : null,
    },
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
        <dt>{t('associated.universalId')}:</dt>
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
  const { t } = useTranslation();
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
          <h2 id="assoc-title">{t('associated.title')}</h2>
          <button
            type="button"
            className="assoc-close"
            onClick={onClose}
            aria-label={t('common.close')}
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
            <p className="assoc-empty">{t('associated.empty')}</p>
          )}

          {loading && <p className="assoc-empty">{t('common.loading')}</p>}
          {error && !loading && <p className="assoc-empty">{error}</p>}

          {!loading && !error && list.length > 0 && (
            <section className="assoc-related">
              <h3 className="assoc-related-title">{t('associated.related')}</h3>
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
