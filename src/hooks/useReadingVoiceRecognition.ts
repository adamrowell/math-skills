import { useState, useEffect, useCallback, useRef } from 'react';
import { ReadingWord } from '../config/readingConfig';

interface ReadingVoiceRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  lastSpokenWord: string | null;
  error: string | null;
  confidence: number;
}

interface UseReadingVoiceRecognitionOptions {
  onWordSpoken?: (word: string) => void;
  onCorrectWord?: (word: string, transcript: string) => void;
  onWrongAttempt?: (spokenWord: string) => void;
  expectedWord?: ReadingWord | null;
  enabled?: boolean;
  childMode?: boolean;
}

// Type definitions for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Clean up transcript to extract spoken words
function cleanTranscript(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 0);
}

// =============================================================================
// HOMOPHONE SYSTEM - Words that sound IDENTICAL when spoken correctly
// =============================================================================
// Homophones are accepted because if speech recognition transcribes "blew" when
// the child said "blue", the child still pronounced it correctly - they sound the same!

const HOMOPHONE_GROUPS: string[][] = [
  // Common homophones kids encounter
  ['to', 'too', 'two'],
  ['their', 'there', 'theyre'],
  ['your', 'youre', 'yore'],
  ['know', 'no'],
  ['knew', 'new', 'gnu'],
  ['write', 'right', 'rite', 'wright'],
  ['see', 'sea'],
  ['be', 'bee'],
  ['by', 'buy', 'bye'],
  ['for', 'four', 'fore'],
  ['ate', 'eight'],
  ['one', 'won'],
  ['son', 'sun'],
  ['would', 'wood'],
  ['our', 'hour'],
  ['flour', 'flower'],
  ['meet', 'meat', 'mete'],
  ['week', 'weak'],
  ['hear', 'here'],
  ['dear', 'deer'],
  ['bear', 'bare'],
  ['pair', 'pear', 'pare'],
  ['fair', 'fare'],
  ['hair', 'hare'],
  ['stair', 'stare'],
  ['where', 'wear', 'ware'],
  ['which', 'witch'],
  ['weather', 'whether', 'wether'],
  ['through', 'threw'],
  ['blue', 'blew'],
  ['do', 'dew', 'due'],
  ['night', 'knight'],
  ['not', 'knot'],
  ['nose', 'knows'],
  ['wait', 'weight'],
  ['way', 'weigh', 'whey'],
  ['made', 'maid'],
  ['mail', 'male'],
  ['sail', 'sale'],
  ['tail', 'tale'],
  ['pale', 'pail'],
  ['plane', 'plain'],
  ['rain', 'reign', 'rein'],
  ['main', 'mane', 'maine'],
  ['pain', 'pane'],
  ['vain', 'vane', 'vein'],
  ['brake', 'break'],
  ['stake', 'steak'],
  ['great', 'grate'],
  ['peace', 'piece'],
  ['feat', 'feet'],
  ['beat', 'beet'],
  ['heal', 'heel', 'heel'],
  ['peel', 'peal'],
  ['steel', 'steal'],
  ['real', 'reel'],
  ['led', 'lead'],
  ['read', 'red', 'redd'],
  ['reed', 'read'],
  ['need', 'knead'],
  ['seed', 'cede'],
  ['creek', 'creak'],
  ['peek', 'peak', 'pique'],
  ['leak', 'leek'],
  ['sweet', 'suite'],
  ['flee', 'flea'],
  ['key', 'quay'],
  ['tea', 'tee'],
  ['pea', 'pee'],
  ['i', 'eye', 'aye'],
  ['hi', 'high'],
  ['die', 'dye'],
  ['lie', 'lye'],
  ['tie', 'thai'],
  ['pie', 'pi'],
  ['so', 'sew', 'sow'],
  ['toe', 'tow'],
  ['woe', 'whoa'],
  ['dough', 'doe'],
  ['owe', 'oh'],
  ['beau', 'bow'],
  ['poll', 'pole'],
  ['roll', 'role'],
  ['sole', 'soul'],
  ['whole', 'hole'],
  ['coal', 'cole'],
  ['bold', 'bowled'],
  ['all', 'awl'],
  ['ball', 'bawl'],
  ['hall', 'haul'],
  ['mall', 'maul'],
  ['caught', 'cot'],
  ['taught', 'taut'],
  ['ant', 'aunt'],
  ['or', 'oar', 'ore'],
  ['war', 'wore'],
  ['warn', 'worn'],
  ['horse', 'hoarse'],
  ['course', 'coarse'],
  ['board', 'bored'],
  ['chord', 'cord', 'cored'],
  ['pour', 'pore', 'poor'],
  ['soar', 'sore'],
  ['some', 'sum'],
  ['none', 'nun'],
  ['but', 'butt'],
  ['ad', 'add'],
  ['inn', 'in'],
  ['scene', 'seen'],
  ['seam', 'seem'],
  ['team', 'teem'],
  ['gene', 'jean'],
  ['sign', 'sine'],
  ['wine', 'whine'],
  ['time', 'thyme'],
  ['climb', 'clime'],
  ['rhyme', 'rime'],
  ['bite', 'byte', 'bight'],
  ['site', 'sight', 'cite'],
  ['might', 'mite'],
  ['light', 'lite'],
  ['slight', 'sleight'],
  ['white', 'wight'],
  ['choose', 'chews'],
  ['use', 'ewes', 'yews'],
  ['cue', 'queue'],
  ['flew', 'flu', 'flue'],
  ['you', 'ewe', 'yew'],
  ['dual', 'duel'],
  ['cell', 'sell'],
  ['cent', 'scent', 'sent'],
  ['cereal', 'serial'],
  ['chute', 'shoot'],
  ['clause', 'claws'],
  ['days', 'daze'],
  ['faint', 'feint'],
  ['fairy', 'ferry'],
  ['faze', 'phase'],
  ['flair', 'flare'],
  ['forth', 'fourth'],
  ['foul', 'fowl'],
  ['gait', 'gate'],
  ['genes', 'jeans'],
  ['grays', 'graze'],
  ['groan', 'grown'],
  ['guessed', 'guest'],
  ['guild', 'gild'],
  ['guilt', 'gilt'],
  ['gym', 'jim'],
  ['hail', 'hale'],
  ['hay', 'hey'],
  ['hays', 'haze'],
  ['heard', 'herd'],
  ['idle', 'idol', 'idyll'],
  ['jam', 'jamb'],
  ['kernel', 'colonel'],
  ['lain', 'lane'],
  ['lays', 'laze'],
  ['lessen', 'lesson'],
  ['liar', 'lyre'],
  ['links', 'lynx'],
  ['loan', 'lone'],
  ['loot', 'lute'],
  ['maize', 'maze'],
  ['manner', 'manor'],
  ['medal', 'meddle'],
  ['metal', 'mettle'],
  ['mince', 'mints'],
  ['mind', 'mined'],
  ['miner', 'minor'],
  ['missed', 'mist'],
  ['moose', 'mousse'],
  ['morning', 'mourning'],
  ['muscle', 'mussel'],
  ['naval', 'navel'],
  ['nay', 'neigh'],
  ['packed', 'pact'],
  ['palate', 'palette', 'pallet'],
  ['passed', 'past'],
  ['patience', 'patients'],
  ['pause', 'paws'],
  ['pedal', 'peddle', 'petal'],
  ['peer', 'pier'],
  ['per', 'purr'],
  ['pleas', 'please'],
  ['plum', 'plumb'],
  ['pray', 'prey'],
  ['presence', 'presents'],
  ['pride', 'pried'],
  ['prince', 'prints'],
  ['principal', 'principle'],
  ['profit', 'prophet'],
  ['quarts', 'quartz'],
  ['rack', 'wrack'],
  ['raid', 'rayed'],
  ['raise', 'rays', 'raze'],
  ['rap', 'wrap'],
  ['rapped', 'rapt', 'wrapped'],
  ['reek', 'wreak'],
  ['rest', 'wrest'],
  ['retch', 'wretch'],
  ['ring', 'wring'],
  ['road', 'rode', 'rowed'],
  ['roe', 'row'],
  ['root', 'route'],
  ['rose', 'rows'],
  ['rote', 'wrote'],
  ['rough', 'ruff'],
  ['rung', 'wrung'],
  ['rye', 'wry'],
  ['sac', 'sack'],
  ['slay', 'sleigh'],
  ['staid', 'stayed'],
  ['stationary', 'stationery'],
  ['step', 'steppe'],
  ['stile', 'style'],
  ['straight', 'strait'],
  ['sundae', 'sunday'],
  ['tacks', 'tax'],
  ['teas', 'tease', 'tees'],
  ['tense', 'tents'],
  ['tern', 'turn'],
  ['throne', 'thrown'],
  ['tide', 'tied'],
  ['timber', 'timbre'],
  ['toad', 'toed', 'towed'],
  ['told', 'tolled'],
  ['troop', 'troupe'],
  ['vale', 'veil'],
  ['wade', 'weighed'],
  ['wail', 'whale'],
  ['waist', 'waste'],
  ['waive', 'wave'],
  ['we', 'wee'],
  ['wheel', 'weal'],
  ['whir', 'were'],
  ['whirl', 'whorl'],
  ['whirled', 'world'],
  ['whit', 'wit'],
  ['allowed', 'aloud'],
  ['berry', 'bury'],
  ['berth', 'birth'],
  ['billed', 'build'],
  ['bloc', 'block'],
  ['bolder', 'boulder'],
  ['born', 'borne'],
  ['bread', 'bred'],
  ['brews', 'bruise'],
  ['bridal', 'bridle'],
  ['capital', 'capitol'],
  ['carat', 'carrot', 'caret'],
  ['cast', 'caste'],
  ['cellar', 'seller'],
  ['yoke', 'yolk'],
];

// Build a map for quick homophone lookup
const homophoneMap = new Map<string, Set<string>>();
for (const group of HOMOPHONE_GROUPS) {
  const normalizedGroup = group.map(w => w.toLowerCase());
  const groupSet = new Set(normalizedGroup);

  normalizedGroup.forEach(word => {
    if (homophoneMap.has(word)) {
      const existingSet = homophoneMap.get(word)!;
      normalizedGroup.forEach(w => existingSet.add(w));
      Array.from(existingSet).forEach(w => homophoneMap.set(w, existingSet));
    } else {
      homophoneMap.set(word, groupSet);
    }
  });
}

// Check if two words are homophones (pronounced identically)
function areHomophones(word1: string, word2: string): boolean {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();

  if (w1 === w2) return true;

  const group = homophoneMap.get(w1);
  if (group && group.has(w2)) return true;

  return false;
}

// =============================================================================
// STRICT WORD MATCHING FOR READING PRACTICE
// =============================================================================
// This is the CORE function for determining if a child said the word correctly.
//
// PHILOSOPHY: For reading practice, we must be STRICT. The child is learning to
// read - accepting wrong words teaches them incorrectly. It's better to ask them
// to try again than to accept "jab" for "job" or "your" for "you".
//
// WHAT WE ACCEPT:
// 1. Exact match (obvious)
// 2. Homophones (words that sound IDENTICAL - "blue"/"blew")
// 3. Configured pronunciation alternatives from the word config
//
// WHAT WE REJECT:
// - Similar-sounding but different words ("your" vs "you", "jab" vs "job")
// - Partial matches ("wok" vs "work")
// - Rhyming words ("cat" vs "hat")
// - ANY fuzzy matching based on Levenshtein distance
//
// If speech recognition misheard, the child can simply say the word again.
// This is much better than accepting wrong pronunciations.

export function doesWordMatch(spoken: string, expected: ReadingWord): boolean {
  const spokenLower = spoken.toLowerCase().trim();
  const expectedLower = expected.word.toLowerCase();

  // 1. EXACT match - always accept
  if (spokenLower === expectedLower) return true;

  // 2. Check if spoken word is a HOMOPHONE of expected word
  // Homophones sound IDENTICAL (e.g., "to/too/two", "blue/blew")
  // This is acceptable because the child pronounced it correctly
  if (areHomophones(spokenLower, expectedLower)) return true;

  // 3. Check configured pronunciation alternatives (exact match or homophone only)
  if (expected.pronunciations) {
    for (const alt of expected.pronunciations) {
      const altLower = alt.toLowerCase().replace(/[^\w\s]/g, '').trim();
      if (spokenLower === altLower) return true;
      if (areHomophones(spokenLower, altLower)) return true;
    }
  }

  // 4. For multi-word expected phrases (e.g., "ice cream", "New York")
  const expectedWords = expectedLower.split(/\s+/);
  if (expectedWords.length > 1) {
    const spokenWords = spokenLower.split(/\s+/);

    // Check if spoken is the words combined (speech recognition might join them)
    const spokenCombined = spokenLower.replace(/\s+/g, '');
    const expectedCombined = expectedLower.replace(/\s+/g, '');
    if (spokenCombined === expectedCombined) return true;

    // Must have same number of words
    if (spokenWords.length !== expectedWords.length) {
      return false;
    }

    // Each word must be exact or a homophone - NO fuzzy matching
    let allMatch = true;
    for (let i = 0; i < expectedWords.length; i++) {
      const spokenWord = spokenWords[i];
      const expectedWord = expectedWords[i];
      const isExact = spokenWord === expectedWord;
      const isHomophone = areHomophones(spokenWord, expectedWord);
      if (!isExact && !isHomophone) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;

    return false;
  }

  // 5. SINGLE WORD - STRICT MATCHING ONLY
  //
  // NO fuzzy matching, NO Levenshtein distance, NO "close enough"
  //
  // Why? Because:
  // - "your" (4 letters) is NOT "you" (3 letters) - different words!
  // - "jab" is NOT "job" - different vowel, different word!
  // - "wok" is NOT "work" - missing letter, different word!
  // - "harpy" is NOT "happy" - different consonant, different word!
  //
  // If the child said it wrong, they need to try again.
  // If speech recognition misheard, they can say it again.
  // Either way, we don't accept wrong words.

  // NO OTHER MATCHING - word must be exact or a homophone
  return false;
}

// =============================================================================
// VOICE RECOGNITION HOOK
// =============================================================================

export function useReadingVoiceRecognition(options: UseReadingVoiceRecognitionOptions = {}) {
  const {
    onWordSpoken,
    onCorrectWord,
    onWrongAttempt,
    expectedWord = null,
    enabled = true,
    childMode = true,
  } = options;

  const [state, setState] = useState<ReadingVoiceRecognitionState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    lastSpokenWord: null,
    error: null,
    confidence: 0,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onWordSpokenRef = useRef(onWordSpoken);
  const onCorrectWordRef = useRef(onCorrectWord);
  const onWrongAttemptRef = useRef(onWrongAttempt);
  const expectedWordRef = useRef(expectedWord);
  const lastProcessedTranscriptRef = useRef<string>('');
  // Track if we've already matched the current expected word
  const matchedCurrentWordRef = useRef<boolean>(false);

  // Keep refs up to date
  useEffect(() => {
    onWordSpokenRef.current = onWordSpoken;
  }, [onWordSpoken]);

  useEffect(() => {
    onCorrectWordRef.current = onCorrectWord;
  }, [onCorrectWord]);

  useEffect(() => {
    onWrongAttemptRef.current = onWrongAttempt;
  }, [onWrongAttempt]);

  useEffect(() => {
    expectedWordRef.current = expectedWord;
    // Clear processed transcript and match flag when word changes
    lastProcessedTranscriptRef.current = '';
    matchedCurrentWordRef.current = false;
  }, [expectedWord]);

  // Check for browser support
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setState((prev) => ({ ...prev, isSupported: true }));
    } else {
      setState((prev) => ({
        ...prev,
        isSupported: false,
        error: 'Speech recognition not supported in this browser',
      }));
    }
  }, []);

  // Start listening
  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition || !enabled) return;

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = childMode ? 5 : 3;

    recognition.onstart = () => {
      lastProcessedTranscriptRef.current = '';
      matchedCurrentWordRef.current = false;
      setState((prev) => ({
        ...prev,
        isListening: true,
        error: null,
        transcript: '',
      }));
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';
      let bestConfidence = 0;

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        // Check all alternatives for the expected word
        for (let j = 0; j < result.length; j++) {
          const alternative = result[j];
          if (alternative.confidence > bestConfidence) {
            bestConfidence = alternative.confidence;
          }

          // Check if expected word is in any alternative
          if (expectedWordRef.current) {
            const words = cleanTranscript(alternative.transcript);
            for (const word of words) {
              if (doesWordMatch(word, expectedWordRef.current)) {
                if (result.isFinal) {
                  finalTranscript = alternative.transcript;
                } else {
                  interimTranscript = alternative.transcript;
                }
                break;
              }
            }
          }
        }

        // Fallback to first alternative
        if (!finalTranscript && !interimTranscript) {
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
      }

      const transcript = finalTranscript || interimTranscript;

      if (transcript) {
        const words = cleanTranscript(transcript);
        const lastWord = words[words.length - 1] || null;

        setState((prev) => ({
          ...prev,
          transcript,
          lastSpokenWord: lastWord,
          confidence: bestConfidence,
        }));

        // Check for correct word
        const expected = expectedWordRef.current;
        let foundCorrect = false;
        if (expected && onCorrectWordRef.current) {
          for (const word of words) {
            if (doesWordMatch(word, expected)) {
              // Normalize transcript for comparison to prevent duplicate calls
              const normalizedTranscript = transcript.toLowerCase().trim();

              // Don't process same match twice
              if (!matchedCurrentWordRef.current &&
                  normalizedTranscript !== lastProcessedTranscriptRef.current) {
                lastProcessedTranscriptRef.current = normalizedTranscript;
                matchedCurrentWordRef.current = true;
                onCorrectWordRef.current(word, transcript);
                foundCorrect = true;
              } else {
                foundCorrect = true;
              }
              break;
            }
          }
        }

        // If we have a final result with a clear word but no match, it's a wrong attempt
        if (finalTranscript && lastWord && expected && !foundCorrect && !matchedCurrentWordRef.current && onWrongAttemptRef.current) {
          // Only count as wrong if the spoken word is substantial (at least 2 chars)
          if (lastWord.length >= 2 && transcript !== lastProcessedTranscriptRef.current) {
            lastProcessedTranscriptRef.current = transcript;
            onWrongAttemptRef.current(lastWord);
          }
        }

        // Notify of any spoken word (final results only)
        if (finalTranscript && lastWord && onWordSpokenRef.current) {
          onWordSpokenRef.current(lastWord);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted' || event.error === 'no-speech') {
        return;
      }

      setState((prev) => ({
        ...prev,
        error: `Speech recognition error: ${event.error}`,
        isListening: false,
      }));
    };

    recognition.onend = () => {
      setState((prev) => ({ ...prev, isListening: false }));

      // Auto-restart in continuous mode
      if (enabled && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // Ignore errors on restart
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to start speech recognition',
        isListening: false,
      }));
    }
  }, [enabled, childMode]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isListening: false,
      transcript: '',
    }));
  }, []);

  // Reset recognition
  const resetRecognition = useCallback(() => {
    lastProcessedTranscriptRef.current = '';
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    setState((prev) => ({
      ...prev,
      transcript: '',
      lastSpokenWord: null,
      confidence: 0,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    resetRecognition,
  };
}
