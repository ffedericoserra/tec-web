import { useCallback, useEffect, useRef, useState } from 'react';
import { COMMANDS, SPEECH_SUPPORTED, listenOnce } from '../voice.js';

function MicIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

/**
 * Opened by "Ask me anything". Holds both ways of issuing a command — the mic
 * and the tap list — so the two can't drift apart; both dispatch the same ids
 * from voice.js. On a browser without SpeechRecognition (Firefox) the mic is
 * hidden and the list is the whole interface, not a degraded one.
 */
export default function CommandSheet({ disabled, onCommand, onClose }) {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState(null);
  const abortRef = useRef(null);

  const stopListening = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        stopListening();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, stopListening]);

  // Abort any in-flight recognition if the sheet unmounts mid-listen.
  useEffect(() => () => abortRef.current?.(), []);

  function backdropClick(e) {
    if (e.target === e.currentTarget) {
      stopListening();
      onClose();
    }
  }

  function toggleMic() {
    if (listening) {
      stopListening();
      setStatus(null);
      return;
    }
    setStatus(null);
    setListening(true);
    abortRef.current = listenOnce({
      onResult: ({ commandId, transcript }) => {
        if (commandId) {
          onCommand(commandId);
          onClose();
        } else {
          setStatus(
            transcript
              ? `Non ho capito: “${transcript}”`
              : 'Non ho capito. Riprova.'
          );
        }
      },
      onError: (err) => {
        setStatus(
          err === 'not-allowed'
            ? 'Microfono non autorizzato.'
            : err === 'no-speech'
              ? 'Non ho sentito nulla. Riprova.'
              : 'Errore del microfono.'
        );
      },
      onEnd: () => {
        abortRef.current = null;
        setListening(false);
      },
    });
  }

  function pick(id) {
    if (disabled?.[id]) return;
    stopListening();
    onCommand(id);
    onClose();
  }

  return (
    <div className="cmd-overlay" onMouseDown={backdropClick}>
      <div
        className="cmd-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmd-title"
      >
        <header className="cmd-head">
          <h2 id="cmd-title">Comandi</h2>
          <button
            type="button"
            className="cmd-close"
            onClick={() => {
              stopListening();
              onClose();
            }}
            aria-label="Chiudi"
          >
            ×
          </button>
        </header>

        <div className="cmd-body">
          {SPEECH_SUPPORTED && (
            <div className="cmd-mic-wrap">
              <button
                type="button"
                className={`cmd-mic${listening ? ' is-listening' : ''}`}
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? 'Interrompi ascolto' : 'Parla'}
              >
                <MicIcon />
              </button>
              <p className="cmd-mic-label">
                {listening ? 'Sto ascoltando…' : 'Tocca e parla'}
              </p>
              {status && <p className="cmd-mic-status">{status}</p>}
            </div>
          )}

          <ul className="cmd-list">
            {COMMANDS.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="cmd-item"
                  onClick={() => pick(c.id)}
                  disabled={!!disabled?.[c.id]}
                >
                  <span className="cmd-item-label">{c.label}</span>
                  <span className="cmd-item-hint">“{c.hint}”</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
