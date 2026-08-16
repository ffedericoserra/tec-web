import { useMemo, useState } from 'react';
import SessionPanel from './SessionPanel.jsx';
import { ACTIVITY_LABELS } from '../session.js';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function questionSections(visit) {
  return (visit?.blocks || []).filter(
    (block) => block.type === 'questions' && block.questions?.length
  );
}

function participantList(participants, responses) {
  const people = new Map();
  participants.forEach((participant) => {
    people.set(String(participant.userId), {
      userId: String(participant.userId),
      username: participant.username || 'Partecipante',
    });
  });
  responses.forEach((response) => {
    const userId = String(response.userId);
    if (!people.has(userId)) {
      people.set(userId, {
        userId,
        username: response.username || 'Partecipante',
      });
    }
  });
  return [...people.values()].sort((a, b) =>
    a.username.localeCompare(b.username, 'it')
  );
}

function findResponse(responses, participantId, sectionId, questionId) {
  return responses.find(
    (response) =>
      String(response.userId) === participantId &&
      response.sectionId === sectionId &&
      response.questionId === questionId
  );
}

function answerText(question, response) {
  if (!response) return 'Nessuna risposta';
  if (question.answerType === 'multiple-choice') {
    return question.options?.[response.selectedIndex] || 'Opzione non disponibile';
  }
  return response.text || 'Nessuna risposta';
}

function correctAnswerText(question) {
  if (
    question.answerType !== 'multiple-choice' ||
    !Number.isInteger(question.correctIndex)
  ) {
    return null;
  }
  return question.options?.[question.correctIndex] || null;
}

function responseOutcome(question, response) {
  if (!response || question.answerType !== 'multiple-choice') return null;
  if (!Number.isInteger(question.correctIndex)) return 'Soluzione non impostata';
  return response.selectedIndex === question.correctIndex ? 'Corretta' : 'Errata';
}

function buildAnswersReport({ visit, code, participants, responses }) {
  const sections = questionSections(visit);
  const people = participantList(participants, responses);
  const lines = [
    'ArtAround - Risposte visita condivisa',
    `Visita: ${visit?.title || 'Senza titolo'}`,
    `Sessione: ${code || '-'}`,
    `Esportato il: ${new Date().toLocaleString('it-IT')}`,
    '',
  ];

  people.forEach((person, participantIndex) => {
    lines.push(`PARTECIPANTE: ${person.username}`);
    sections.forEach((section, sectionIndex) => {
      lines.push(`Sezione ${sectionIndex + 1}: ${section.blockName || 'Domande'}`);
      section.questions.forEach((question, questionIndex) => {
        const response = findResponse(
          responses,
          person.userId,
          String(section._id),
          String(question._id)
        );
        lines.push(`${questionIndex + 1}. ${question.prompt}`);
        lines.push(`   Risposta: ${answerText(question, response)}`);

        const correctAnswer = correctAnswerText(question);
        if (question.answerType === 'multiple-choice') {
          lines.push(`   Risposta corretta: ${correctAnswer || 'Non impostata'}`);
          lines.push(`   Esito: ${responseOutcome(question, response) || 'Non risposta'}`);
        }
      });
      lines.push('');
    });
    if (participantIndex < people.length - 1) lines.push('');
  });

  if (people.length === 0) lines.push('Nessun partecipante nella sessione.');
  return lines.join('\r\n');
}

export default function ActivitiesPanel({
  activities,
  visit,
  responses,
  participants,
  sessionCode,
  onClose,
}) {
  const [view, setView] = useState('activities');
  const newestFirst = [...activities].reverse();
  const sections = useMemo(() => questionSections(visit), [visit]);
  const people = useMemo(
    () => participantList(participants, responses),
    [participants, responses]
  );
  const totalQuestions = sections.reduce(
    (total, section) => total + section.questions.length,
    0
  );

  function downloadAnswers() {
    const report = buildAnswersReport({
      visit,
      code: sessionCode,
      participants,
      responses,
    });
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeCode = String(sessionCode || 'sessione').replace(/[^a-z0-9_-]/gi, '-');
    link.href = url;
    link.download = `risposte-${safeCode}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const footer = view === 'answers' && sections.length > 0 && (
    <div className="activity-export-bar">
      <button
        type="button"
        className="activity-export-btn"
        onClick={downloadAnswers}
      >
        Scarica risposte .txt
      </button>
    </div>
  );

  return (
    <SessionPanel title="Activities" onClose={onClose} footer={footer}>
      <div className="activity-tabs" role="tablist" aria-label="Contenuto attività">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'activities'}
          className={view === 'activities' ? 'is-active' : ''}
          onClick={() => setView('activities')}
        >
          Attività
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'answers'}
          className={view === 'answers' ? 'is-active' : ''}
          onClick={() => setView('answers')}
        >
          Risposte
          {responses.length > 0 && (
            <span className="activity-tab-count">{responses.length}</span>
          )}
        </button>
      </div>

      {view === 'activities' ? (
        newestFirst.length === 0 ? (
          <p className="panel-empty">Nothing yet.</p>
        ) : (
          <ul className="panel-list">
            {newestFirst.map((activity, index) => (
              <li
                key={`${activity.participantId}-${activity.timestamp}-${index}`}
                className="activity-row"
              >
                <span className="activity-user">{activity.username}</span>{' '}
                {ACTIVITY_LABELS[activity.action] || activity.action}
                <span className="activity-time">{formatTime(activity.timestamp)}</span>
              </li>
            ))}
          </ul>
        )
      ) : sections.length === 0 ? (
        <p className="panel-empty">Questa visita non contiene domande.</p>
      ) : people.length === 0 ? (
        <p className="panel-empty">Nessun partecipante nella sessione.</p>
      ) : (
        <div className="activity-answer-summary" aria-live="polite">
          {people.map((person) => {
            const participantResponses = responses.filter(
              (response) => String(response.userId) === person.userId
            );
            return (
              <section className="activity-participant-answers" key={person.userId}>
                <div className="activity-participant-head">
                  <h3>{person.username}</h3>
                  <span>{participantResponses.length}/{totalQuestions}</span>
                </div>

                {sections.map((section) => (
                  <div className="activity-section-summary" key={String(section._id)}>
                    <h4>{section.blockName || 'Domande'}</h4>
                    {section.questions.map((question, questionIndex) => {
                      const response = findResponse(
                        responses,
                        person.userId,
                        String(section._id),
                        String(question._id)
                      );
                      const outcome = responseOutcome(question, response);
                      return (
                        <div className="activity-answer-row" key={String(question._id)}>
                          <p className="activity-question-text">
                            {questionIndex + 1}. {question.prompt}
                          </p>
                          <p className={response ? 'activity-answer-text' : 'activity-answer-text is-empty'}>
                            {answerText(question, response)}
                          </p>
                          {outcome && (
                            <span
                              className={`activity-answer-outcome${
                                outcome === 'Corretta' ? ' is-correct' :
                                outcome === 'Errata' ? ' is-wrong' : ''
                              }`}
                            >
                              {outcome}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </SessionPanel>
  );
}
