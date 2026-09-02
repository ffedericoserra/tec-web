import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, getCachedUser } from '../api.js';
import { logout } from '../auth.js';

function questionId(question) {
  return String(question?._id || '');
}

function responseText(question, response, t) {
  if (question.answerType === 'multiple-choice') {
    return question.options?.[response.selectedIndex] || t('questions.optionUnavailable');
  }
  return response.text || '—';
}

function responseStatus(question, response, t) {
  if (question.answerType === 'open') {
    return { kind: 'manual', label: t('questions.manualReview') };
  }
  if (response.isCorrect === true) {
    return { kind: 'correct', label: t('questions.correct') };
  }
  if (response.isCorrect === false) {
    return { kind: 'incorrect', label: t('questions.incorrect') };
  }
  return { kind: 'pending', label: t('questions.notEvaluated') };
}

export default function QuestionSectionScreen({
  section,
  code,
  isOwner,
  responses,
  isFirst,
  isLast,
  onPrevious,
  onNext,
  nextLabel,
}) {
  const { t } = useTranslation();
  const me = getCachedUser();
  const questions = section?.questions || [];
  const sectionId = String(section?._id || '');
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const sectionResponses = useMemo(
    () => responses.filter((response) => response.sectionId === sectionId),
    [responses, sectionId]
  );

  useEffect(() => {
    if (isOwner) return;
    const mine = sectionResponses.filter(
      (response) => String(response.userId) === String(me?._id)
    );
    const restored = {};
    mine.forEach((response) => {
      restored[response.questionId] =
        response.answerType === 'multiple-choice'
          ? response.selectedIndex
          : response.text || '';
    });
    setAnswers(restored);
    setSubmitted(mine.length === questions.length && questions.length > 0);
    setError(null);
  }, [sectionId, sectionResponses, questions.length, isOwner, me?._id]);

  async function submitAnswers(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      await Promise.all(
        questions.map((question) => {
          const id = questionId(question);
          const value = answers[id];
          const body =
            question.answerType === 'multiple-choice'
              ? { questionId: id, selectedIndex: value }
              : { questionId: id, text: String(value || '').trim() };
          return api(
            `/sessions/${encodeURIComponent(code)}/sections/${encodeURIComponent(sectionId)}/answers`,
            { method: 'POST', body }
          );
        })
      );
      setSubmitted(true);
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setError('questions.submitError');
    } finally {
      setBusy(false);
    }
  }

  const allAnswered = questions.every((question) => {
    const value = answers[questionId(question)];
    return question.answerType === 'multiple-choice'
      ? Number.isInteger(value)
      : Boolean(String(value || '').trim());
  });

  return (
    <div className="section-question-screen">
      <div className="section-question-heading">
        <span>{t('questions.sectionKicker')}</span>
        <h1>{section?.blockName || t('questions.fallbackTitle')}</h1>
        <p>
          {isOwner
            ? t('questions.ownerIntro')
            : t('questions.participantIntro')}
        </p>
      </div>

      {isOwner ? (
        <div className="section-live-results" aria-live="polite">
          {questions.map((question, index) => {
            const id = questionId(question);
            const questionResponses = sectionResponses.filter(
              (response) => response.questionId === id
            );
            return (
              <section className="section-result-group" key={id}>
                <div className="section-result-title">
                  <h2>{index + 1}. {question.prompt}</h2>
                  <span>{t('questions.responses', { count: questionResponses.length })}</span>
                </div>
                {questionResponses.length === 0 ? (
                  <p className="section-result-empty">{t('questions.waiting')}</p>
                ) : (
                  <ul>
                    {questionResponses.map((response) => {
                      const status = responseStatus(question, response, t);
                      return (
                        <li key={`${response.userId}-${id}`}>
                          <strong>{response.username || t('common.participant')}</strong>
                          <span>{responseText(question, response, t)}</span>
                          <span className={`section-response-status is-${status.kind}`}>
                            {status.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <form className="section-question-form" onSubmit={submitAnswers}>
          {questions.map((question, index) => {
            const id = questionId(question);
            return (
              <fieldset key={id}>
                <legend>{index + 1}. {question.prompt}</legend>
                {question.answerType === 'multiple-choice' ? (
                  <div className="section-question-options">
                    {(question.options || []).map((option, optionIndex) => (
                      <label
                        key={optionIndex}
                        className={answers[id] === optionIndex ? 'is-selected' : ''}
                      >
                        <input
                          type="radio"
                          name={`section-question-${id}`}
                          checked={answers[id] === optionIndex}
                          onChange={() =>
                            setAnswers((current) => ({
                              ...current,
                              [id]: optionIndex,
                            }))
                          }
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={answers[id] || ''}
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [id]: event.target.value,
                      }))
                    }
                    rows="4"
                    maxLength="1000"
                    placeholder={t('questions.answerPlaceholder')}
                  />
                )}
              </fieldset>
            );
          })}
          {submitted && (
            <p className="section-submit-success">{t('questions.sent')}</p>
          )}
          {error && <p className="quiz-error" role="alert">{t(error)}</p>}
          <button
            type="submit"
            className="quiz-submit"
            disabled={!allAnswered || busy}
          >
            {busy
              ? t('questions.sending')
              : submitted
                ? t('questions.update')
                : t('questions.submit')}
          </button>
        </form>
      )}

      {isOwner && (
        <div className="visit-bottom-bar section-question-navigation">
          <button
            type="button"
            className="visit-nav-btn"
            onClick={onPrevious}
            disabled={isFirst}
          >
            {t('visitRun.previous')}
          </button>
          <button
            type="button"
            className="visit-nav-btn"
            onClick={onNext}
            disabled={isLast}
          >
            {nextLabel || t('visitRun.next')}
          </button>
        </div>
      )}
    </div>
  );
}
