import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMANDS, SPEECH_SUPPORTED, listenOnce } from '../voice.js';
import { normalizeLanguage } from '../i18n.js';

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
  const { t, i18n } = useTranslation();
  const language = normalizeLanguage(i18n.resolvedLanguage) || 'it';
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
      language,
      onResult: ({ commandId, transcript }) => {
        if (commandId) {
          onCommand(commandId);
          onClose();
        } else {
          setStatus(
            transcript
              ? { key: 'voice.notUnderstoodTranscript', values: { transcript } }
              : { key: 'voice.notUnderstood' }
          );
        }
      },
      onError: (err) => {
        setStatus(
          err === 'not-allowed'
            ? { key: 'voice.microphoneDenied' }
            : err === 'no-speech'
              ? { key: 'voice.noSpeech' }
              : { key: 'voice.microphoneError' }
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
          <h2 id="cmd-title">{t('voice.title')}</h2>
          <button
            type="button"
            className="cmd-close"
            onClick={() => {
              stopListening();
              onClose();
            }}
            aria-label={t('common.close')}
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
                aria-label={listening ? t('voice.stopListening') : t('voice.speak')}
              >
                <MicIcon />
              </button>
              <p className="cmd-mic-label">
                {listening ? t('voice.listening') : t('voice.tapAndSpeak')}
              </p>
              {status && (
                <p className="cmd-mic-status" role="status">
                  {t(status.key, status.values)}
                </p>
              )}
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
                  <span className="cmd-item-label">
                    {t(`voice.commands.${c.id}.label`)}
                  </span>
                  <span className="cmd-item-hint">
                    “{t(`voice.commands.${c.id}.hint`)}”
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
