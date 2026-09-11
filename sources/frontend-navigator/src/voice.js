/**
 * Voice control — controlled vocabulary for the visit runner.
 *
 * Pure logic, no React. The COMMANDS registry is the single source of truth for
 * both entry points: the spoken matcher below and the tappable list in
 * CommandSheet.jsx. Adding a command here makes it available in both at once.
 *
 * The command ids are stable across languages. Labels live in the i18n
 * catalogues; this module owns only the phrases speech recognition must match.
 */

const SR =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const SPEECH_SUPPORTED = !!SR;

export const COMMANDS = [
  {
    id: 'more',
    phrases: {
      it: ['versione più lunga', 'dimmi di più', 'allunga la descrizione'],
      en: ['longer version', 'tell me more', 'make it longer'],
    },
  },
  {
    id: 'shorter',
    phrases: {
      it: ['versione più breve', 'sintetizza', 'accorcia la descrizione', 'più breve'],
      en: ['shorter version', 'summarize', 'make it shorter'],
    },
  },
  {
    id: 'complex',
    phrases: {
      it: ['tono più complesso', 'rendi più complesso', 'approfondisci'],
      en: ['more complex tone', 'make it more complex', 'increase complexity'],
    },
  },
  {
    id: 'simpler',
    phrases: {
      it: ['tono più semplice', 'semplifica il linguaggio', 'semplifica'],
      en: ['simpler tone', 'use simpler language', 'make it simpler'],
    },
  },
  {
    id: 'next',
    phrases: {
      it: ['prossimo', 'successivo', 'vai avanti'],
      en: ['next', 'go forward'],
    },
  },
  {
    id: 'previous',
    phrases: {
      it: ['precedente', 'torna indietro'],
      en: ['previous', 'go back'],
    },
  },
  {
    id: 'map',
    phrases: {
      it: ['apri la mappa', 'mostra la mappa'],
      en: ['open the map', 'show the map'],
    },
  },
  {
    id: 'details',
    phrases: {
      it: ['mostra la scheda del contenuto', 'mostra dettagli', 'apri la scheda'],
      en: ['show content details', 'show details', 'open content details'],
    },
  },
];

/* Flattened {phrase, id} pairs sorted longest-first, computed per language and
 * cached. The order matters: longer, specific phrases must win over fragments;
 * matching shortest-first can route overlapping phrases to the wrong command. */
const PHRASE_INDEXES = new Map();

function languageCode(language) {
  return String(language || '').toLowerCase().startsWith('en') ? 'en' : 'it';
}

function phraseIndex(language) {
  const code = languageCode(language);
  if (!PHRASE_INDEXES.has(code)) {
    PHRASE_INDEXES.set(
      code,
      COMMANDS.flatMap((command) =>
        command.phrases[code].map((phrase) => ({
          phrase: normalize(phrase),
          id: command.id,
        }))
      ).sort((a, b) => b.phrase.length - a.phrase.length)
    );
  }
  return PHRASE_INDEXES.get(code);
}

/* Accents are folded (più → piu, è → e) because recognizers are inconsistent
 * about emitting them, and a missing accent shouldn't lose a command. Apostrophe
 * variants are folded too — recognizers emit the typographic ’ as often as '. */
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/[.,!?¡¿;:"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsPhrase(text, phrase) {
  let start = 0;
  while (start <= text.length - phrase.length) {
    const index = text.indexOf(phrase, start);
    if (index === -1) return false;
    const before = text[index - 1];
    const after = text[index + phrase.length];
    if ((!before || before === ' ') && (!after || after === ' ')) return true;
    start = index + 1;
  }
  return false;
}

/** Match a spoken transcript against the vocabulary. Returns a command id or null. */
export function matchCommand(transcript, language = 'it') {
  const text = normalize(transcript);
  if (!text) return null;
  for (const { phrase, id } of phraseIndex(language)) {
    if (containsPhrase(text, phrase)) return id;
  }
  return null;
}

/**
 * Listen for a single utterance (push-to-talk) and report the matched command.
 *
 * Continuous listening is deliberately not used: the runner reads descriptions
 * aloud via speechSynthesis, and an open mic hears that voice and fires phantom
 * commands. Cancelling TTS on start is part of the same defence.
 *
 * Returns an abort() function.
 */
export function listenOnce({ language = 'it', onResult, onError, onEnd }) {
  if (!SR) {
    onError?.('unsupported');
    onEnd?.();
    return () => {};
  }

  // Never listen while the app is talking.
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  const recognition = new SR();
  const code = languageCode(language);
  recognition.lang = code === 'en' ? 'en-US' : 'it-IT';
  recognition.continuous = false;
  recognition.interimResults = false;
  // The vocabulary is small and fixed, so testing every alternative costs
  // nothing and recovers a lot of near-misses.
  recognition.maxAlternatives = 3;

  recognition.onresult = (event) => {
    const alternatives = Array.from(event.results?.[0] || []);
    let matched = null;
    let heard = '';
    for (const alt of alternatives) {
      if (!heard) heard = alt.transcript || '';
      const id = matchCommand(alt.transcript, code);
      if (id) {
        matched = id;
        heard = alt.transcript;
        break;
      }
    }
    onResult?.({ commandId: matched, transcript: heard });
  };

  recognition.onerror = (event) => {
    onError?.(event.error || 'error');
  };

  recognition.onend = () => {
    onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    // start() throws if a recognition session is already running.
    onError?.('busy');
    onEnd?.();
  }

  return () => {
    try {
      recognition.abort();
    } catch {
      /* already stopped */
    }
  };
}
