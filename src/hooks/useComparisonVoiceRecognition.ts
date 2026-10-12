import { useState, useEffect, useCallback, useRef } from 'react';
import { ComparisonResult } from '../config/comparisonConfig';

interface VoiceRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
}

interface UseComparisonVoiceRecognitionOptions {
  enabled?: boolean;
  onResult?: (answer: ComparisonResult, transcript: string) => void;
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

// Word patterns for each answer type
const LEFT_PATTERNS = ['left', 'this one', 'first', 'first one', 'one', 'that one'];
const RIGHT_PATTERNS = ['right', 'other', 'second', 'second one', 'two', 'other one'];
const EQUAL_PATTERNS = ['equal', 'equals', 'same', 'they are the same', 'the same', 'both', 'neither', 'tie'];

function parseComparisonAnswer(transcript: string): ComparisonResult | null {
  const lower = transcript.toLowerCase().trim();

  // Check for equal/same first (more specific)
  for (const pattern of EQUAL_PATTERNS) {
    if (lower.includes(pattern)) {
      return 'equal';
    }
  }

  // Check for left
  for (const pattern of LEFT_PATTERNS) {
    if (lower.includes(pattern)) {
      return 'left';
    }
  }

  // Check for right
  for (const pattern of RIGHT_PATTERNS) {
    if (lower.includes(pattern)) {
      return 'right';
    }
  }

  return null;
}

export function useComparisonVoiceRecognition(options: UseComparisonVoiceRecognitionOptions = {}) {
  const { enabled = true, onResult } = options;

  const [state, setState] = useState<VoiceRecognitionState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    error: null,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  const lastProcessedTranscriptRef = useRef<string>('');

  // Keep the callback ref up to date
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

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

  // Initialize recognition
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
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      lastProcessedTranscriptRef.current = '';
      setState((prev) => ({
        ...prev,
        isListening: true,
        error: null,
        transcript: '',
      }));
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';

      // Get the latest result
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        // Check all alternatives for a match
        for (let j = 0; j < result.length; j++) {
          const alternative = result[j].transcript;
          const answer = parseComparisonAnswer(alternative);

          if (answer && result.isFinal) {
            transcript = alternative;

            // Don't process the same transcript twice
            if (transcript !== lastProcessedTranscriptRef.current) {
              lastProcessedTranscriptRef.current = transcript;

              setState((prev) => ({
                ...prev,
                transcript,
              }));

              if (onResultRef.current) {
                onResultRef.current(answer, transcript);
              }
            }
            return;
          }
        }

        // Fallback to first alternative for display
        if (result.isFinal) {
          transcript = result[0].transcript;
        } else {
          transcript = result[0].transcript;
        }
      }

      if (transcript) {
        setState((prev) => ({
          ...prev,
          transcript,
        }));
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Don't treat 'aborted' or 'no-speech' as errors
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

      // Auto-restart if still enabled
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
  }, [enabled]);

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

  // Reset recognition - stops and restarts to clear the buffer
  const resetRecognition = useCallback(() => {
    lastProcessedTranscriptRef.current = '';
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      // Will auto-restart due to continuous mode in onend handler
    }
    setState((prev) => ({
      ...prev,
      transcript: '',
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
