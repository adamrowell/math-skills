import { useState, useEffect, useCallback, useRef } from 'react';
import { GeographyItem } from './useGeographyGameState';
import { USStateData } from '../data/geography/usStates';
import { CountryData } from '../data/geography/countries';
import { BodyOfWaterData } from '../data/geography/bodiesOfWater';
import { LandmarkData } from '../data/geography/landmarks';

interface GeographyVoiceRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  lastSpokenWord: string | null;
  error: string | null;
  confidence: number;
}

interface UseGeographyVoiceRecognitionOptions {
  onWordSpoken?: (word: string) => void;
  onCorrectMatch?: (spokenWord: string, transcript: string) => void;
  onWrongAttempt?: (spokenWord: string) => void;
  expectedItem?: GeographyItem | null;
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

// Helper type guards
function isUSState(item: GeographyItem): item is USStateData {
  return 'abbreviation' in item && 'region' in item;
}

function isCountry(item: GeographyItem): item is CountryData {
  return 'continent' in item && 'capital' in item && !('city' in item);
}

function isBodyOfWater(item: GeographyItem): item is BodyOfWaterData {
  return 'type' in item && ['ocean', 'sea', 'lake', 'gulf', 'bay'].includes((item as BodyOfWaterData).type);
}

function isLandmark(item: GeographyItem): item is LandmarkData {
  return 'category' in item && 'country' in item && 'imageUrl' in item;
}

// Get the expected name and variations for an item
function getExpectedNames(item: GeographyItem): { name: string; variations: string[] } {
  if (isUSState(item)) {
    return {
      name: item.name,
      variations: item.pronunciations || [],
    };
  }
  if (isCountry(item)) {
    return {
      name: item.name,
      variations: item.pronunciations || [],
    };
  }
  if (isBodyOfWater(item)) {
    return {
      name: item.name,
      variations: item.pronunciations || [],
    };
  }
  if (isLandmark(item)) {
    return {
      name: item.name,
      variations: [],
    };
  }
  return { name: '', variations: [] };
}

// Clean up transcript to extract spoken words
function cleanTranscript(transcript: string): string {
  return transcript
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .trim();
}

// Calculate Levenshtein distance between two strings
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Check if spoken matches expected item
function doesMatch(spoken: string, item: GeographyItem): boolean {
  const { name, variations } = getExpectedNames(item);
  const spokenLower = cleanTranscript(spoken);
  const expectedLower = name.toLowerCase();

  // Exact match
  if (spokenLower === expectedLower) return true;

  // Check pronunciation variations
  for (const variation of variations) {
    if (spokenLower === variation.toLowerCase().replace(/[^\w\s]/g, '')) {
      return true;
    }
  }

  // For multi-word names (e.g., "New York", "United States")
  const expectedWords = expectedLower.split(/\s+/);
  const spokenWords = spokenLower.split(/\s+/);

  if (expectedWords.length > 1) {
    // Check if all words are present
    if (spokenWords.length >= expectedWords.length) {
      let allMatch = true;
      for (let i = 0; i < expectedWords.length; i++) {
        if (spokenWords[i] !== expectedWords[i] && levenshteinDistance(spokenWords[i], expectedWords[i]) > 2) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) return true;
    }

    // Check combined (no spaces)
    const spokenCombined = spokenLower.replace(/\s+/g, '');
    const expectedCombined = expectedLower.replace(/\s+/g, '');
    if (spokenCombined === expectedCombined) return true;
    if (levenshteinDistance(spokenCombined, expectedCombined) <= 2) return true;
  }

  // Fuzzy match for single words or remaining cases
  const lenDiff = Math.abs(spokenLower.length - expectedLower.length);

  // For short names (3-5 letters), allow 1 difference
  if (expectedLower.length <= 5 && lenDiff <= 1) {
    return levenshteinDistance(spokenLower, expectedLower) <= 1;
  }

  // For medium names (6-10 letters), allow 2 differences
  if (expectedLower.length <= 10 && lenDiff <= 2) {
    return levenshteinDistance(spokenLower, expectedLower) <= 2;
  }

  // For longer names, allow up to 3 differences
  if (lenDiff <= 3) {
    return levenshteinDistance(spokenLower, expectedLower) <= 3;
  }

  return false;
}

export function useGeographyVoiceRecognition(options: UseGeographyVoiceRecognitionOptions = {}) {
  const {
    onWordSpoken,
    onCorrectMatch,
    onWrongAttempt,
    expectedItem = null,
    enabled = true,
    childMode = true,
  } = options;

  const [state, setState] = useState<GeographyVoiceRecognitionState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    lastSpokenWord: null,
    error: null,
    confidence: 0,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onWordSpokenRef = useRef(onWordSpoken);
  const onCorrectMatchRef = useRef(onCorrectMatch);
  const onWrongAttemptRef = useRef(onWrongAttempt);
  const expectedItemRef = useRef(expectedItem);
  const lastProcessedTranscriptRef = useRef<string>('');
  const matchedCurrentItemRef = useRef<boolean>(false);

  // Keep refs up to date
  useEffect(() => {
    onWordSpokenRef.current = onWordSpoken;
  }, [onWordSpoken]);

  useEffect(() => {
    onCorrectMatchRef.current = onCorrectMatch;
  }, [onCorrectMatch]);

  useEffect(() => {
    onWrongAttemptRef.current = onWrongAttempt;
  }, [onWrongAttempt]);

  useEffect(() => {
    expectedItemRef.current = expectedItem;
    lastProcessedTranscriptRef.current = '';
    matchedCurrentItemRef.current = false;
  }, [expectedItem]);

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
      matchedCurrentItemRef.current = false;
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

        // Check all alternatives
        for (let j = 0; j < result.length; j++) {
          const alternative = result[j];
          if (alternative.confidence > bestConfidence) {
            bestConfidence = alternative.confidence;
          }

          // Check if expected item matches
          if (expectedItemRef.current) {
            const cleanedTranscript = cleanTranscript(alternative.transcript);
            if (doesMatch(cleanedTranscript, expectedItemRef.current)) {
              if (result.isFinal) {
                finalTranscript = alternative.transcript;
              } else {
                interimTranscript = alternative.transcript;
              }
              break;
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
        const cleanedTranscript = cleanTranscript(transcript);

        setState((prev) => ({
          ...prev,
          transcript,
          lastSpokenWord: cleanedTranscript,
          confidence: bestConfidence,
        }));

        // Check for correct match
        const expected = expectedItemRef.current;
        let foundCorrect = false;
        if (expected && onCorrectMatchRef.current) {
          if (doesMatch(cleanedTranscript, expected)) {
            if (transcript !== lastProcessedTranscriptRef.current) {
              lastProcessedTranscriptRef.current = transcript;
              matchedCurrentItemRef.current = true;
              onCorrectMatchRef.current(cleanedTranscript, transcript);
              foundCorrect = true;
            } else {
              foundCorrect = true;
            }
          }
        }

        // Wrong attempt check
        if (finalTranscript && expected && !foundCorrect && !matchedCurrentItemRef.current && onWrongAttemptRef.current) {
          if (cleanedTranscript.length >= 2 && transcript !== lastProcessedTranscriptRef.current) {
            lastProcessedTranscriptRef.current = transcript;
            onWrongAttemptRef.current(cleanedTranscript);
          }
        }

        // Notify of spoken word
        if (finalTranscript && onWordSpokenRef.current) {
          onWordSpokenRef.current(cleanedTranscript);
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
    } catch {
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
    matchedCurrentItemRef.current = false;
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

export default useGeographyVoiceRecognition;
