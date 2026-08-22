import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SessionPanel from './SessionPanel.jsx';
import { ACTIVITY_LABELS } from '../session.js';
import { localeForLanguage } from '../i18n.js';

function formatTime(ts, language) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(localeForLanguage(language), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function questionSections(visit) {
  return (visit?.blocks || []).filter(
    (block) => block.type === 'questions' && block.questions?.length
  );
}

function participantList(participants, responses, t, language) {
  const people = new Map();
  participants.forEach((participant) => {
    people.set(String(participant.userId), {
      userId: String(participant.userId),
      username: participant.username || t('common.participant'),
    });
  });
  responses.forEach((response) => {
    const userId = String(response.userId);
    if (!people.has(userId)) {
      people.set(userId, {
        userId,
        username: response.username || t('common.participant'),
      });
    }
  });
  return [...people.values()].sort((a, b) =>
    a.username.localeCompare(b.username, localeForLanguage(language))
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

function answerText(question, response, t) {
  if (!response) return t('activities.noAnswer');
  if (question.answerType === 'multiple-choice') {
    return question.options?.[response.selectedIndex] || t('activities.optionUnavailable');
  }
  return response.text || t('activities.noAnswer');
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
  if (!Number.isInteger(question.correctIndex)) return 'unset';
  return response.selectedIndex === question.correctIndex ? 'correct' : 'wrong';
}

function buildAnswersReport({ visit, code, participants, responses, t, language }) {
  const sections = questionSections(visit);
  const people = participantList(participants, responses, t, language);
  const lines = [
    t('activities.report.title'),
    t('activities.report.visit', {
      title: visit?.title || t('activities.report.untitled'),
    }),
    t('activities.report.session', { code: code || '-' }),
    t('activities.report.exported', {
      date: new Date().toLocaleString(localeForLanguage(language)),
    }),
    '',
  ];

  people.forEach((person, participantIndex) => {
    lines.push(t('activities.report.participant', { username: person.username }));
    sections.forEach((section, sectionIndex) => {
      lines.push(
        t('activities.report.section', {
          number: sectionIndex + 1,
          title: section.blockName || t('activities.questionsFallback'),
        })
      );
      section.questions.forEach((question, questionIndex) => {
        const response = findResponse(
          responses,
          person.userId,
          String(section._id),
          String(question._id)
        );
        lines.push(`${questionIndex + 1}. ${question.prompt}`);
        lines.push(
          t('activities.report.answer', {
            answer: answerText(question, response, t),
          })
        );

        const correctAnswer = correctAnswerText(question);
        if (question.answerType === 'multiple-choice') {
          lines.push(
            t('activities.report.correctAnswer', {
              answer: correctAnswer || t('activities.report.unset'),
            })
          );
          const outcome = responseOutcome(question, response);
          lines.push(
            t('activities.report.outcome', {
              outcome: outcome
                ? t(`activities.${outcome === 'unset' ? 'solutionUnset' : outcome}`)
                : t('activities.notAnswered'),
            })
          );
        }
      });
      lines.push('');
    });
    if (participantIndex < people.length - 1) lines.push('');
  });

  if (people.length === 0) lines.push(t('activities.noParticipants'));
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
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage;
  const [view, setView] = useState('activities');
  const newestFirst = [...activities].reverse();
  const sections = useMemo(() => questionSections(visit), [visit]);
  const people = useMemo(
    () => participantList(participants, responses, t, language),
    [participants, responses, t, language]
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
      t,
      language,
    });
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeCode = String(sessionCode || 'session').replace(/[^a-z0-9_-]/gi, '-');
    link.href = url;
    link.download = t('activities.downloadFilename', { code: safeCode });
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
        {t('activities.download')}
      </button>
    </div>
  );

  return (
    <SessionPanel title={t('activities.title')} onClose={onClose} footer={footer}>
      <div className="activity-tabs" role="tablist" aria-label={t('activities.tabsAria')}>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'activities'}
          className={view === 'activities' ? 'is-active' : ''}
          onClick={() => setView('activities')}
        >
          {t('activities.tabActivities')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'answers'}
          className={view === 'answers' ? 'is-active' : ''}
          onClick={() => setView('answers')}
        >
          {t('activities.tabAnswers')}
          {responses.length > 0 && (
            <span className="activity-tab-count">{responses.length}</span>
          )}
        </button>
      </div>

      {view === 'activities' ? (
        newestFirst.length === 0 ? (
          <p className="panel-empty">{t('activities.empty')}</p>
        ) : (
          <ul className="panel-list">
            {newestFirst.map((activity, index) => (
              <li
                key={`${activity.participantId}-${activity.timestamp}-${index}`}
                className="activity-row"
              >
                <span className="activity-user">{activity.username}</span>{' '}
                {ACTIVITY_LABELS[activity.action]
                  ? t(ACTIVITY_LABELS[activity.action])
                  : activity.action}
                <span className="activity-time">
                  {formatTime(activity.timestamp, language)}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : sections.length === 0 ? (
        <p className="panel-empty">{t('activities.noQuestions')}</p>
      ) : people.length === 0 ? (
        <p className="panel-empty">{t('activities.noParticipants')}</p>
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
                    <h4>{section.blockName || t('activities.questionsFallback')}</h4>
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
                            {answerText(question, response, t)}
                          </p>
                          {outcome && (
                            <span
                              className={`activity-answer-outcome${
                                outcome === 'correct' ? ' is-correct' :
                                outcome === 'wrong' ? ' is-wrong' : ''
                              }`}
                            >
                              {t(
                                `activities.${
                                  outcome === 'unset' ? 'solutionUnset' : outcome
                                }`
                              )}
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
