import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { isAuthenticated, logout } from '../auth.js';
import PageHeader from '../components/PageHeader.jsx';
import AssociatedContentsModal from '../components/AssociatedContentsModal.jsx';
import CommandSheet from '../components/CommandSheet.jsx';
import MuseumMap from '../components/MuseumMap.jsx';
import '../styles/visitRun.css';

const LENGTHS = ['3s', '15s', '45s'];

/* Order matters: it's the order shown in the tone menu, easiest first. Values
 * match `descriptions[].tone` as written by the marketplace. */
const TONES = ['easy', 'medium', 'complex'];
const TONE_LABELS = { easy: 'Easy', medium: 'Medium', complex: 'Complex' };

const TTS_SUPPORTED =
  typeof window !== 'undefined' && 'speechSynthesis' in window;

/* A horizontal drag shorter than this is a tap or a stray finger, not a swipe. */
const SWIPE_THRESHOLD = 45;
/* How far a gesture must travel before we commit to calling it horizontal or
 * vertical. Below this the direction is still ambiguous. */
const SWIPE_AXIS_LOCK = 10;

/**
 * The description for the requested tone, falling back to the item's first tone
 * when it doesn't carry that one. Every item authored through the marketplace now
 * has all three, but seeded or older items may not, and silently showing nothing
 * would be worse than showing the wrong tone.
 */
function pickDescription(item, tone) {
  const list = item?.descriptions;
  if (!list?.length) return null;
  return list.find((d) => d.tone === tone) || list[0];
}

function availableTones(item) {
  const list = item?.descriptions || [];
  return TONES.filter((t) => list.some((d) => d.tone === t));
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

  /* Tone is a visit-wide preference, not per-stop: a visitor who wants the easy
   * register wants it for the whole visit. Kept even when a given item can't
   * honour it, so it re-applies at the next item that can. */
  const [tone, setTone] = useState('easy');
  const [toneMenuOpen, setToneMenuOpen] = useState(false);

  const [assocOpen, setAssocOpen] = useState(false);
  const [assocLoading, setAssocLoading] = useState(false);
  const [assocError, setAssocError] = useState(null);
  const [assocCache, setAssocCache] = useState({});
  const [assocItemId, setAssocItemId] = useState(null);

  const [ttsEnabled, setTtsEnabled] = useState(false);

  /* Content images are resolved server-side from uploads/contents/, so a URL
   * here normally means the file exists. It can still 404 if the file is deleted
   * between the load and the visit — fall back to the placeholder rather than
   * showing a broken image. Keyed by URL so one bad image doesn't affect the
   * other stops. */
  const [brokenImages, setBrokenImages] = useState(() => new Set());

  // Answer to a question command ('author' / 'year' / 'exit'). When set it takes
  // over the description body; any navigation command clears it.
  const [answer, setAnswer] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

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
  const description = pickDescription(item, tone);
  const maxLen = lastAvailableLengthIdx(description);
  const itemTones = availableTones(item);
  /* What the user is actually hearing, which is the preference only when this
   * item carries it. The pill shows this rather than the preference so it never
   * claims a tone the text isn't in. */
  const effectiveTone = description?.tone || tone;

  /* One entry per sequence position for the map. Coordinates live on the
   * Content, not the Item, so they're resolved through the same contents map the
   * image and the details modal use. Entries keep their index even when they
   * have no coordinates — the map lists those separately rather than renumbering. */
  const mapStops = useMemo(
    () =>
      sequence.map((seqEntry, i) => {
        const seqItem = seqEntry?.itemId;
        const seqContent = seqItem?.contentId ? contents[seqItem.contentId] : null;
        return {
          index: i,
          name: seqContent?.name || seqItem?.contentId || `Tappa ${i + 1}`,
          lat: seqContent?.coordinates?.lat,
          lng: seqContent?.coordinates?.lng,
        };
      }),
    [sequence, contents]
  );

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

  /* Same dismissal contract as ProfileMenu: outside-mousedown or Escape. */
  useEffect(() => {
    if (!toneMenuOpen) return;
    function onDown(e) {
      if (!e.target.closest('.visit-tone')) setToneMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setToneMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [toneMenuOpen]);

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

  function selectTone(next) {
    setToneMenuOpen(false);
    setTone(next);
    // Keep the reading depth across the switch — you change tone to re-hear the
    // same amount of detail differently — but don't land past the end if the new
    // tone happens to carry fewer lengths.
    const nextMax = lastAvailableLengthIdx(pickDescription(item, next));
    setLengthIdx((i) => Math.min(i, nextMax));
  }

  /* Swipe across the description to change length: left for longer, right for
   * shorter. The same ladder Describe! and the voice commands walk, so all three
   * stay in sync through `lengthIdx`. */
  function stepLength(delta) {
    if (mode !== 'describe' || answer) return;
    setLengthIdx((i) => Math.min(Math.max(i + delta, 0), maxLen));
  }

  const swipe = useRef(null);

  function onDescPointerDown(e) {
    if (mode !== 'describe' || answer) return;
    swipe.current = { x: e.clientX, y: e.clientY, axis: null };
  }

  function onDescPointerMove(e) {
    const s = swipe.current;
    if (!s || s.axis) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < SWIPE_AXIS_LOCK) return;
    /* Lock the axis once the gesture is unambiguous. A vertical gesture is
     * abandoned outright so it scrolls the description normally — this block is
     * the only scrollable region on the page. */
    s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  }

  function onDescPointerUp(e) {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.axis !== 'x') return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    stepLength(dx < 0 ? 1 : -1);
  }

  function onDescPointerCancel() {
    // Fired when the browser takes the gesture over for vertical scrolling.
    swipe.current = null;
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
      case 'map':
        setMapOpen(true);
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
  const showImage = imageUrl && !brokenImages.has(imageUrl);

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
        {showImage ? (
          <img
            key={imageUrl}
            src={imageUrl}
            alt={contentName}
            className="visit-image"
            onError={() =>
              setBrokenImages((prev) => new Set(prev).add(imageUrl))
            }
          />
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
        onPointerDown={onDescPointerDown}
        onPointerMove={onDescPointerMove}
        onPointerUp={onDescPointerUp}
        onPointerCancel={onDescPointerCancel}
      >
        <div className="visit-desc-head">
          {answer ? (
            <span className="visit-answer-pill">Risposta</span>
          ) : mode === 'describe' && description ? (
            <div className="visit-tone">
              <button
                type="button"
                className="visit-tone-pill"
                onClick={() => setToneMenuOpen((v) => !v)}
                aria-expanded={toneMenuOpen}
                aria-haspopup="menu"
                aria-label={`Tono: ${TONE_LABELS[effectiveTone]}. Cambia tono`}
              >
                {TONE_LABELS[effectiveTone] || effectiveTone}
                <span className="visit-tone-caret" aria-hidden="true">
                  ▾
                </span>
              </button>
              {toneMenuOpen && (
                <div className="visit-tone-menu" role="menu">
                  {TONES.map((t) => {
                    const has = itemTones.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        role="menuitemradio"
                        aria-checked={t === effectiveTone}
                        className={`visit-tone-option${
                          t === effectiveTone ? ' is-active' : ''
                        }`}
                        onClick={() => selectTone(t)}
                        disabled={!has}
                        title={has ? undefined : 'Non disponibile per quest’opera'}
                      >
                        {TONE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <span />
          )}

          {mode === 'describe' && description && !answer && (
            <div
              className="visit-length-dots"
              aria-label={`Lunghezza ${lengthIdx + 1} di ${maxLen + 1}`}
            >
              {Array.from({ length: maxLen + 1 }, (_, i) => (
                <span
                  key={i}
                  className={`visit-length-dot${
                    i === lengthIdx ? ' is-active' : ''
                  }`}
                  aria-hidden="true"
                />
              ))}
            </div>
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
          onClick={() => setMapOpen(true)}
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

      {mapOpen && (
        <MuseumMap
          museum={visit.museumId}
          stops={mapStops}
          currentIndex={entryIndex}
          onClose={() => setMapOpen(false)}
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
