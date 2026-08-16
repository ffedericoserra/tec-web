import { useEffect, useMemo, useState } from 'react';
import { api, getCachedUser } from '../api.js';
import { logout } from '../auth.js';

function questionId(question) {
  return String(question?._id || '');
}

function responseText(question, response) {
  if (question.answerType === 'multiple-choice') {
    return question.options?.[response.selectedIndex] || 'Opzione non disponibile';
  }
  return response.text || '—';
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
  nextLabel = 'Next',
}) {
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
      setError(err.message || 'Invio delle risposte non riuscito');
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
        <span>Question section</span>
        <h1>{section?.blockName || 'Questions'}</h1>
        <p>
          {isOwner
            ? 'Le risposte dei partecipanti compaiono qui in tempo reale.'
            : 'Rispondi alle domande. Puoi aggiornare le risposte finché la sezione è attiva.'}
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
                  <span>{questionResponses.length} risposte</span>
                </div>
                {questionResponses.length === 0 ? (
                  <p className="section-result-empty">In attesa delle risposte…</p>
                ) : (
                  <ul>
                    {questionResponses.map((response) => (
                      <li key={`${response.userId}-${id}`}>
                        <strong>{response.username || 'Partecipante'}</strong>
                        <span>{responseText(question, response)}</span>
                      </li>
                    ))}
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
                    placeholder="Scrivi la tua risposta"
                  />
                )}
              </fieldset>
            );
          })}
          {submitted && (
            <p className="section-submit-success">Risposte inviate.</p>
          )}
          {error && <p className="quiz-error" role="alert">{error}</p>}
          <button
            type="submit"
            className="quiz-submit"
            disabled={!allAnswered || busy}
          >
            {busy ? 'Invio…' : submitted ? 'Aggiorna risposte' : 'Invia risposte'}
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
            Previous
          </button>
          <button
            type="button"
            className="visit-nav-btn"
            onClick={onNext}
            disabled={isLast}
          >
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  );
}
