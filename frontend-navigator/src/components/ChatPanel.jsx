import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api.js';
import { logout } from '../auth.js';
import SessionPanel from './SessionPanel.jsx';

/**
 * Group chat for a session, open to both roles.
 *
 * Sending POSTs to /sessions/:code/message and does *not* append locally — the
 * server broadcasts the saved message back to the whole room including the
 * sender, so every client appends by exactly one path and there's no optimistic
 * copy to reconcile. Messages arrive as props from VisitRun, which owns the
 * socket.
 */
export default function ChatPanel({ code, messages, meId, onClose }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const bodyEndRef = useRef(null);

  // Stick to the newest message, both on open and as messages arrive.
  useEffect(() => {
    bodyEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/sessions/${encodeURIComponent(code)}/message`, {
        method: 'POST',
        body: { text: trimmed },
      });
      setText('');
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setError('chat.sendError');
    } finally {
      setBusy(false);
    }
  }

  const footer = (
    <form className="chat-form" onSubmit={handleSubmit}>
      <input
        className="chat-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('chat.placeholder')}
        maxLength={500}
        aria-label={t('chat.messageAria')}
        autoFocus
      />
      <button type="submit" className="chat-send" disabled={busy || !text.trim()}>
        {t('chat.send')}
      </button>
    </form>
  );

  return (
    <SessionPanel title={t('chat.title')} onClose={onClose} footer={footer}>
      {messages.length === 0 ? (
        <p className="panel-empty">{t('chat.empty')}</p>
      ) : (
        <ul className="panel-list">
          {messages.map((m, i) => {
            const mine = m.userId === meId;
            return (
              <li
                key={`${m.userId}-${m.timestamp}-${i}`}
                className={`chat-msg${mine ? ' is-mine' : ''}`}
              >
                {!mine && <span className="chat-msg-author">{m.username}</span>}
                <span className="chat-msg-text">{m.text}</span>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="quiz-error">{t(error)}</p>}
      <div ref={bodyEndRef} />
    </SessionPanel>
  );
}
