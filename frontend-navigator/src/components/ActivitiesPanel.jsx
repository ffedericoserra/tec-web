import SessionPanel from './SessionPanel.jsx';
import { ACTIVITY_LABELS } from '../session.js';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/**
 * The teacher-only feed of what students are doing — "federicoserra asked:
 * who's the author?" in the mockup.
 *
 * Rows are the controlled-vocabulary commands from voice.js, logged whenever a
 * student issues one by voice or tap. That's the whole vocabulary the Base tier
 * offers, so the feed is complete rather than a sample: there is no free-text
 * question a student could ask that wouldn't appear here.
 *
 * Newest first — during a live visit the teacher cares about what just happened.
 */
export default function ActivitiesPanel({ activities, onClose }) {
  const newestFirst = [...activities].reverse();

  return (
    <SessionPanel title="Activities" onClose={onClose}>
      {newestFirst.length === 0 ? (
        <p className="panel-empty">Nothing yet.</p>
      ) : (
        <ul className="panel-list">
          {newestFirst.map((a, i) => (
            <li
              key={`${a.participantId}-${a.timestamp}-${i}`}
              className="activity-row"
            >
              <span className="activity-user">{a.username}</span>{' '}
              {ACTIVITY_LABELS[a.action] || a.action}
              <span className="activity-time">{formatTime(a.timestamp)}</span>
            </li>
          ))}
        </ul>
      )}
    </SessionPanel>
  );
}
