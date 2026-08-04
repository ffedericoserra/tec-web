import { useEffect } from 'react';

/**
 * The shell the participants / chat / activities panels share: a bottom sheet
 * with a title bar, dismissed by backdrop mousedown or Escape — the same
 * contract as CommandSheet and MuseumMap, so every overlay in the runner closes
 * the same way.
 *
 * `footer` sits outside the scrolling body, which is what lets the chat's
 * composer stay pinned while the backlog scrolls behind it.
 */
export default function SessionPanel({ title, onClose, children, footer }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function backdropDown(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="panel-overlay" onMouseDown={backdropDown}>
      <div
        className="panel-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="panel-head">
          <h2>{title}</h2>
          <button
            type="button"
            className="panel-close"
            onClick={onClose}
            aria-label="Chiudi"
          >
            ×
          </button>
        </header>
        <div className="panel-body">{children}</div>
        {footer}
      </div>
    </div>
  );
}
