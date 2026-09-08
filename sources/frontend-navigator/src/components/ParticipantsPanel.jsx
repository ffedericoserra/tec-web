import SessionPanel from './SessionPanel.jsx';
import { useTranslation } from 'react-i18next';
import { localeForLanguage } from '../i18n.js';

/**
 * Who is in the group visit. Opened by the people icon, available to both roles
 * — a student wants to know the group is with them as much as the teacher does.
 *
 * The session code is shown to the owner only, and prominently: it's the one
 * thing the teacher has to read out loud to get everyone in, and there is
 * nowhere else in the runner it appears at a readable size.
 */
export default function ParticipantsPanel({
  code,
  isOwner,
  ownerName,
  participants,
  meId,
  onClose,
}) {
  const { t, i18n } = useTranslation();
  // Active first, then alphabetically — a teacher scanning the room wants the
  // people actually present at the top.
  const sorted = [...participants].sort((a, b) => {
    if (!!a.isActive !== !!b.isActive) return a.isActive ? -1 : 1;
    return (a.username || '').localeCompare(
      b.username || '',
      localeForLanguage(i18n.resolvedLanguage)
    );
  });

  const activeCount = participants.filter((p) => p.isActive).length;

  return (
    <SessionPanel title={t('participants.title', { count: activeCount })} onClose={onClose}>
      {isOwner && (
        <p className="participant-code">
          <span className="participant-code-label">{t('participants.sessionCode')}</span>
          <span className="participant-code-value">{code}</span>
        </p>
      )}

      <ul className="panel-list">
        <li className="participant-row">
          <span className="participant-dot is-active" aria-hidden="true" />
          <span className="participant-name">{ownerName || t('common.guide')}</span>
          <span className="participant-tag">{t('common.guide').toLowerCase()}</span>
        </li>
        {sorted.map((p) => (
          <li key={p.userId} className="participant-row">
            <span
              className={`participant-dot${p.isActive ? ' is-active' : ''}`}
              aria-hidden="true"
            />
            <span className="participant-name">{p.username}</span>
            <span className="participant-tag">
              {p.userId === meId ? t('common.you') : p.isActive ? '' : t('common.left')}
            </span>
          </li>
        ))}
      </ul>

      {participants.length === 0 && (
        <p className="panel-empty">
          {isOwner
            ? t('participants.nobody')
            : t('participants.first')}
        </p>
      )}
    </SessionPanel>
  );
}
