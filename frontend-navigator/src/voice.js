/**
 * Voice control — controlled vocabulary for the visit runner.
 *
 * Pure logic, no React. The COMMANDS registry is the single source of truth for
 * both entry points: the spoken matcher below and the tappable list in
 * CommandSheet.jsx. Adding a command here makes it available in both at once.
 *
 * Recognition runs at it-IT to match the TTS voice and the Italian content, so
 * the phrases are Italian even though the UI labels are English.
 */

const SR =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const SPEECH_SUPPORTED = !!SR;

export const COMMANDS = [
  {
    id: 'more',
    label: 'Tell me more',
    hint: 'dimmi di più',
    phrases: ['dimmi di più', 'più dettagli', 'raccontami di più', 'approfondisci', 'continua'],
  },
  {
    id: 'simpler',
    label: 'Simpler',
    hint: 'più semplice',
    phrases: ['più semplice', 'semplifica', 'più breve', 'più corto', 'meno dettagli'],
  },
  {
    id: 'next',
    label: 'Next item',
    hint: 'avanti',
    phrases: ['prossima opera', 'vai avanti', 'prossimo', 'successivo', 'avanti'],
  },
  {
    id: 'previous',
    label: 'Previous item',
    hint: 'indietro',
    phrases: ['opera precedente', 'torna indietro', 'precedente', 'indietro'],
  },
  {
    id: 'author',
    label: "Who's the author?",
    hint: "chi è l'autore",
    phrases: ["chi è l'autore", "chi l'ha dipinto", "chi l'ha fatto", 'autore'],
  },
  {
    id: 'year',
    label: 'What year is it from?',
    hint: 'di che anno è',
    phrases: ['di che anno è', 'in che anno', "quand'è stato fatto", 'anno'],
  },
  {
    id: 'exit',
    label: 'Where is the exit?',
    hint: "dov'è l'uscita",
    phrases: ["dov'è l'uscita", 'dove si esce', 'come si esce', 'uscita'],
  },
  {
    id: 'map',
    label: 'Show the map',
    hint: 'mostra la mappa',
    phrases: [
      'fammi vedere la mappa',
      'mostra la mappa',
      'apri la mappa',
      "dov'è la mappa",
      'mappa',
      'pianta',
    ],
  },
];

/* Flattened {phrase, id} pairs sorted longest-first, computed once at module
 * load. The order matters: "dimmi di più" contains "più", and `simpler` owns
 * "più breve" — matching shortest-first would route the wrong way. Longest-first
 * means the most specific phrase always wins. */
const PHRASE_INDEX = COMMANDS.flatMap((c) =>
  c.phrases.map((phrase) => ({ phrase: normalize(phrase), id: c.id }))
).sort((a, b) => b.phrase.length - a.phrase.length);

/* Accents are folded (più → piu, è → e) because recognizers are inconsistent
 * about emitting them, and a missing accent shouldn't lose a command. Apostrophe
 * variants are folded too — recognizers emit the typographic ’ as often as '. */
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/[.,!?;:"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Match a spoken transcript against the vocabulary. Returns a command id or null. */
export function matchCommand(transcript) {
  const text = normalize(transcript);
  if (!text) return null;
  for (const { phrase, id } of PHRASE_INDEX) {
    if (text.includes(phrase)) return id;
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
export function listenOnce({ onResult, onError, onEnd }) {
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
  recognition.lang = 'it-IT';
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
      const id = matchCommand(alt.transcript);
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
