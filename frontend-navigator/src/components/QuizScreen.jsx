import { useState } from 'react';
import { api } from '../api.js';
import { logout } from '../auth.js';

/**
 * The end-of-visit quiz. One component, two faces, because the two roles are
 * looking at the same event from opposite sides:
 *
 *  - student: answers the questions, then sees their score
 *  - teacher: never answers, watches the scores land live
 *
 * The teacher's `results` come from VisitRun, which collects them off the
 * `session:quiz-submitted` broadcast. The questions themselves arrive on the
 * session payload with `correctIndex` stripped for students, so a determined
 * one can't read the key out of the network tab.
 */
export default function QuizScreen({ quiz, code, isOwner, results }) {
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (isOwner) {
    return (
      <div className="quiz-screen">
        <p className="quiz-intro">
          {results.length === 0
            ? 'Waiting for the first answers…'
            : `${results.length} submitted`}
        </p>
        {results.length === 0 ? (
          <p className="quiz-waiting">
            Your group is taking the quiz. Scores appear here as they finish.
          </p>
        ) : (
          <ul className="panel-list">
            {[...results]
              .sort((a, b) => b.quizScore - a.quizScore)
              .map((r) => (
                <li key={r.userId} className="quiz-results-row">
                  <span>{r.username}</span>
                  <span className="quiz-results-score">
                    {r.quizScore}/{r.total ?? quiz.length}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
    );
  }

  if (score !== null) {
    return (
      <div className="quiz-screen">
        <div className="quiz-score">
          <div className="quiz-score-value">
            {score.score}/{score.total}
          </div>
          <p className="quiz-score-label">
            {score.score === score.total
              ? 'Perfect! Well done.'
              : 'Thanks for taking part.'}
          </p>
        </div>
      </div>
    );
  }

  const allAnswered = quiz.every((_, i) => answers[i] !== undefined);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!allAnswered || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api(`/sessions/${encodeURIComponent(code)}/quiz`, {
        method: 'POST',
        body: {
          answers: quiz.map((_, i) => ({
            questionIndex: i,
            selectedIndex: answers[i],
          })),
        },
      });
      setScore({ score: res.score, total: res.total });
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setError(err.message || 'Invio non riuscito');
      setBusy(false);
    }
  }

  return (
    <form className="quiz-screen" onSubmit={handleSubmit}>
      <p className="quiz-intro">Answer all the questions, then submit.</p>
      {quiz.map((q, qi) => (
        <fieldset className="quiz-q" key={qi}>
          <legend className="quiz-q-text">{q.question}</legend>
          <div className="quiz-options">
            {(q.options || []).map((opt, oi) => (
              <label
                key={oi}
                className={`quiz-option${
                  answers[qi] === oi ? ' is-selected' : ''
                }`}
              >
                <input
                  type="radio"
                  name={`q-${qi}`}
                  checked={answers[qi] === oi}
                  onChange={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error && <p className="quiz-error">{error}</p>}
      <button type="submit" className="quiz-submit" disabled={!allAnswered || busy}>
        {busy ? 'Submitting…' : 'Submit answers'}
      </button>
    </form>
  );
}
