import SessionPanel from './SessionPanel.jsx';

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
  // Active first, then alphabetically — a teacher scanning the room wants the
  // people actually present at the top.
  const sorted = [...participants].sort((a, b) => {
    if (!!a.isActive !== !!b.isActive) return a.isActive ? -1 : 1;
    return (a.username || '').localeCompare(b.username || '');
  });

  const activeCount = participants.filter((p) => p.isActive).length;

  return (
    <SessionPanel title={`Participants (${activeCount})`} onClose={onClose}>
      {isOwner && (
        <p className="participant-code">
          <span className="participant-code-label">Session code</span>
          <span className="participant-code-value">{code}</span>
        </p>
      )}

      <ul className="panel-list">
        <li className="participant-row">
          <span className="participant-dot is-active" aria-hidden="true" />
          <span className="participant-name">{ownerName || 'Guide'}</span>
          <span className="participant-tag">guide</span>
        </li>
        {sorted.map((p) => (
          <li key={p.userId} className="participant-row">
            <span
              className={`participant-dot${p.isActive ? ' is-active' : ''}`}
              aria-hidden="true"
            />
            <span className="participant-name">{p.username}</span>
            <span className="participant-tag">
              {p.userId === meId ? 'you' : p.isActive ? '' : 'left'}
            </span>
          </li>
        ))}
      </ul>

      {participants.length === 0 && (
        <p className="panel-empty">
          {isOwner
            ? 'Nobody has joined yet. Share the code above.'
            : 'You are the first one here.'}
        </p>
      )}
    </SessionPanel>
  );
}
