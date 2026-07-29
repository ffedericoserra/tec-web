import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { isAuthenticated, logout } from '../auth.js';
import PageHeader from '../components/PageHeader.jsx';
import AssociatedContentsModal from '../components/AssociatedContentsModal.jsx';
import CommandSheet from '../components/CommandSheet.jsx';
import '../styles/visitRun.css';

const LENGTHS = ['3s', '15s', '45s'];

const TTS_SUPPORTED =
  typeof window !== 'undefined' && 'speechSynthesis' in window;

function pickDescription(item) {
  return item?.descriptions?.[0] || null;
}

function SpeakerIcon({ active }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon
        points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
        fill={active ? 'currentColor' : 'none'}
      />
      {active ? (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      ) : (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      )}
    </svg>
  );
}

function findText(description, lengthIdx) {
  if (!description) return '';
  const target = LENGTHS[lengthIdx];
  return description.texts?.find((t) => t.lengthCategory === target)?.text || '';
}

function lastAvailableLengthIdx(description) {
  if (!description?.texts?.length) return 0;
  let max = 0;
  for (let i = 0; i < LENGTHS.length; i++) {
    if (description.texts.some((t) => t.lengthCategory === LENGTHS[i])) {
      max = i;
    }
  }
  return max;
}

export default function VisitRun() {
  const { museumSlug, visitSlug } = useParams();
  const navigate = useNavigate();

  const [visit, setVisit] = useState(null);
  const [contents, setContents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [entryIndex, setEntryIndex] = useState(0);
  const [mode, setMode] = useState('describe');
  const [lengthIdx, setLengthIdx] = useState(0);

  const [assocOpen, setAssocOpen] = useState(false);
  const [assocLoading, setAssocLoading] = useState(false);
  const [assocError, setAssocError] = useState(null);
  const [assocCache, setAssocCache] = useState({});
  const [assocItemId, setAssocItemId] = useState(null);

  const [ttsEnabled, setTtsEnabled] = useState(false);

  // Answer to a question command ('author' / 'year' / 'exit'). When set it takes
  // over the description body; any navigation command clears it.
  const [answer, setAnswer] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      api(`/visits/${visitSlug}`),
      api(`/museums/${museumSlug}/contents`),
    ])
      .then(([visRes, contentsRes]) => {
        if (cancelled) return;
        const map = {};
        for (const c of contentsRes.contents || []) {
          if (c.universalId) map[c.universalId] = c;
        }
        setContents(map);
        setVisit(visRes.visit);
        setEntryIndex(0);
        setMode('describe');
        setLengthIdx(0);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) {
          logout();
          return;
        }
        if (err.status === 404) {
          navigate(`/${museumSlug}`, { replace: true });
          return;
        }
        setError(err.message || 'Impossibile caricare la visita');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [museumSlug, visitSlug, navigate]);

  const sequence = visit?.sequence || [];
  const entry = sequence[entryIndex] || null;
  const item = entry?.itemId || null;
  const content = item?.contentId ? contents[item.contentId] : null;
  const description = pickDescription(item);
  const maxLen = lastAvailableLengthIdx(description);

  const isFirst = entryIndex === 0;
  const isLast = entryIndex >= sequence.length - 1;
  const atMaxLength = mode === 'describe' && lengthIdx >= maxLen;

  let bodyText = '';
  if (!visit || sequence.length === 0) {
    bodyText = '';
  } else if (answer) {
    // Wins over the description. Because the TTS effect below keys on bodyText,
    // answers get spoken automatically with no extra speech code.
    bodyText = answer;
  } else if (mode === 'logistic') {
    const prevEntry = sequence[entryIndex - 1];
    bodyText =
      prevEntry?.nextDirections?.trim() ||
      entry?.prevDirections?.trim() ||
      'Vai al prossimo punto della visita.';
  } else if (description) {
    bodyText =
      findText(description, lengthIdx) ||
      'Nessuna descrizione disponibile per questa lunghezza.';
  } else {
    bodyText = 'Nessuna descrizione disponibile.';
  }

  useEffect(() => {
    if (!TTS_SUPPORTED) return;
    if (!ttsEnabled || !bodyText) {
      window.speechSynthesis.cancel();
      return;
    }
    const utter = new SpeechSynthesisUtterance(bodyText);
    utter.lang = 'it-IT';
    utter.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    return () => window.speechSynthesis.cancel();
  }, [ttsEnabled, bodyText]);

  function goNext() {
    if (isLast) return;
    setAnswer(null);
    setEntryIndex((i) => i + 1);
    setMode('logistic');
    setLengthIdx(0);
  }

  function goPrevious() {
    if (isFirst) return;
    setAnswer(null);
    setEntryIndex((i) => i - 1);
    setMode('describe');
    setLengthIdx(0);
  }

  function handleDescribe() {
    setAnswer(null);
    if (mode === 'logistic') {
      setMode('describe');
      setLengthIdx(0);
    } else if (lengthIdx < maxLen) {
      setLengthIdx((i) => i + 1);
    }
  }

  // "Simpler" — step back down the length ladder (45s → 15s → 3s). At 3s it's a
  // no-op rather than falling back to logistic mode: dropping the user into
  // walking directions when they asked for a simpler description is confusing.
  function handleSimpler() {
    setAnswer(null);
    if (mode !== 'describe') return;
    if (lengthIdx > 0) setLengthIdx((i) => i - 1);
  }

  function answerAuthor() {
    setAnswer(
      content?.author
        ? `L'autore è ${content.author}.`
        : 'Autore non disponibile per quest’opera.'
    );
  }

  function answerYear() {
    setAnswer(
      content?.year
        ? `Anno: ${content.year}.`
        : 'Anno non disponibile per quest’opera.'
    );
  }

  function answerExit() {
    // POIs ride along on the visit fetch — getVisit populates museumId unselected.
    const pois = visit?.museumId?.pointsOfInterest || [];
    const exits = pois.filter((p) => p.type === 'exit' && p.label);
    if (exits.length === 0) {
      setAnswer('Nessuna uscita indicata per questo museo.');
      return;
    }
    // No "nearest" claim — the Base tier is explicitly map without positioning.
    setAnswer(
      exits.length === 1
        ? `L'uscita è: ${exits[0].label}.`
        : `Uscite disponibili: ${exits.map((e) => e.label).join(', ')}.`
    );
  }

  /* The one place the mic and the tap list converge. */
  function runCommand(id) {
    switch (id) {
      case 'more':
        handleDescribe();
        break;
      case 'simpler':
        handleSimpler();
        break;
      case 'next':
        goNext();
        break;
      case 'previous':
        goPrevious();
        break;
      case 'author':
        answerAuthor();
        break;
      case 'year':
        answerYear();
        break;
      case 'exit':
        answerExit();
        break;
      default:
        break;
    }
  }

  // Which commands can't do anything right now — greys out the sheet's rows.
  const commandsDisabled = {
    more: atMaxLength,
    simpler: mode !== 'describe' || lengthIdx === 0,
    next: isLast,
    previous: isFirst,
  };

  function handleEndVisit() {
    navigate(`/${museumSlug}`);
  }

  async function openAssociated() {
    if (!item) return;
    setAssocItemId(item._id);
    setAssocOpen(true);
    setAssocError(null);
    if (assocCache[item._id]) return;
    setAssocLoading(true);
    try {
      const res = await api(`/items/${item._id}`);
      setAssocCache((c) => ({ ...c, [item._id]: res.item }));
    } catch (err) {
      if (err.status === 401) {
        logout();
        return;
      }
      setAssocError(err.message || 'Errore nel caricamento');
    } finally {
      setAssocLoading(false);
    }
  }

  function closeAssociated() {
    setAssocOpen(false);
    setAssocItemId(null);
  }

  if (loading) {
    return (
      <div className="page-visit-run">
        <PageHeader />
        <p className="visit-status">Caricamento…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-visit-run">
        <PageHeader
          right={
            <button
              type="button"
              className="end-visit-btn"
              onClick={handleEndVisit}
            >
              End Visit
            </button>
          }
        />
        <p className="visit-status error">{error}</p>
      </div>
    );
  }

  if (!visit || sequence.length === 0) {
    return (
      <div className="page-visit-run">
        <PageHeader
          subtitle={visit?.museumId?.name}
          right={
            <button
              type="button"
              className="end-visit-btn"
              onClick={handleEndVisit}
            >
              End Visit
            </button>
          }
        />
        <p className="visit-status">Questa visita è vuota.</p>
      </div>
    );
  }

  const museumName = visit.museumId?.name || '';
  const contentName = content?.name || (item?.contentId || '—');
  const imageUrl = content?.imageUrl;

  return (
    <div className="page-visit-run">
      <PageHeader
        subtitle={museumName}
        right={
          <button
            type="button"
            className="end-visit-btn"
            onClick={handleEndVisit}
          >
            End Visit
          </button>
        }
      />

      <div className="visit-image-wrap">
        {imageUrl ? (
          <img src={imageUrl} alt={contentName} className="visit-image" />
        ) : (
          <div className="visit-image-placeholder">{contentName}</div>
        )}
        <button
          type="button"
          className="visit-image-plus"
          onClick={openAssociated}
          aria-label="Mostra contenuti associati"
          disabled={!item}
        >
          +
        </button>
      </div>

      <div className="visit-actions-row">
        <button
          type="button"
          className={`visit-describe-btn${
            mode === 'logistic' ? ' is-prompt' : ''
          }`}
          onClick={handleDescribe}
          disabled={atMaxLength}
        >
          Describe!
        </button>
        <button
          type="button"
          className="visit-ask-btn"
          onClick={() => setSheetOpen(true)}
        >
          Ask me anything
        </button>
      </div>

      <div
        className={`visit-description${
          mode === 'logistic' && !answer ? ' is-logistic' : ''
        }${answer ? ' is-answer' : ''}`}
      >
        <div className="visit-desc-head">
          {answer ? (
            <span className="visit-answer-pill">Risposta</span>
          ) : mode === 'describe' && description ? (
            <span className="visit-length-pill">{LENGTHS[lengthIdx]}</span>
          ) : (
            <span />
          )}
          {answer && (
            <button
              type="button"
              className="visit-answer-close"
              onClick={() => setAnswer(null)}
              aria-label="Chiudi la risposta"
            >
              ×
            </button>
          )}
          {TTS_SUPPORTED && !answer && (
            <button
              type="button"
              className={`visit-tts-btn${ttsEnabled ? ' is-on' : ''}`}
              onClick={() => setTtsEnabled((v) => !v)}
              aria-pressed={ttsEnabled}
              aria-label={
                ttsEnabled ? 'Disattiva la voce' : 'Attiva la voce'
              }
              title={ttsEnabled ? 'Disattiva la voce' : 'Attiva la voce'}
            >
              <SpeakerIcon active={ttsEnabled} />
            </button>
          )}
        </div>
        <p>{bodyText}</p>
      </div>

      <div className="visit-bottom-bar">
        <button
          type="button"
          className="visit-nav-btn"
          onClick={goPrevious}
          disabled={isFirst}
        >
          Previous
        </button>
        <button
          type="button"
          className="visit-nav-btn"
          onClick={goNext}
          disabled={isLast}
        >
          Next
        </button>
        <button
          type="button"
          className="visit-nav-btn"
          onClick={(e) => e.preventDefault()}
          aria-disabled="true"
          title="Coming soon"
        >
          Map
        </button>
      </div>

      {sheetOpen && (
        <CommandSheet
          disabled={commandsDisabled}
          onCommand={runCommand}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {assocOpen && (
        <AssociatedContentsModal
          content={content}
          item={assocItemId ? assocCache[assocItemId] : null}
          loading={assocLoading}
          error={assocError}
          onClose={closeAssociated}
        />
      )}
    </div>
  );
}
