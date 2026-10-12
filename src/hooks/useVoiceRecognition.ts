import { useState, useEffect, useCallback, useRef } from 'react';
import { getMostLikelyAnswer, doesTranscriptContainAnswer } from '../utils/numberParser';

interface VoiceRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  lastRecognizedNumber: number | null;
  error: string | null;
  confidence: number;
}

interface UseVoiceRecognitionOptions {
  continuous?: boolean;
  onResult?: (number: number) => void;
  onAnswerDetected?: (number: number, transcript: string) => void;
  expectedAnswer?: number | null; // The correct answer we're looking for
  enabled?: boolean;
  childMode?: boolean; // Enable child-friendly recognition settings
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

export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const {
    continuous = true,
    onResult,
    onAnswerDetected,
    expectedAnswer = null,
    enabled = true,
    childMode = true, // Default to child-friendly mode
  } = options;

  const [state, setState] = useState<VoiceRecognitionState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    lastRecognizedNumber: null,
    error: null,
    confidence: 0,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef(onResult);
  const onAnswerDetectedRef = useRef(onAnswerDetected);
  const expectedAnswerRef = useRef(expectedAnswer);
  const lastProcessedTranscriptRef = useRef<string>('');

  // Keep the callback refs up to date
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    onAnswerDetectedRef.current = onAnswerDetected;
  }, [onAnswerDetected]);

  useEffect(() => {
    expectedAnswerRef.current = expectedAnswer;
  }, [expectedAnswer]);

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
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    // Use more alternatives for better chance of correct recognition
    // Especially helpful for children's voices
    recognition.maxAlternatives = childMode ? 5 : 3;

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
      let finalTranscript = '';
      let interimTranscript = '';
      let bestConfidence = 0;

      // Process all results and alternatives
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        // Check all alternatives, not just the first one
        for (let j = 0; j < result.length; j++) {
          const alternative = result[j];
          if (alternative.confidence > bestConfidence) {
            bestConfidence = alternative.confidence;
          }

          // In child mode, also check if expected answer appears in any alternative
          if (childMode && expectedAnswerRef.current !== null) {
            if (doesTranscriptContainAnswer(alternative.transcript, expectedAnswerRef.current)) {
              // Found the expected answer in an alternative!
              if (result.isFinal) {
                finalTranscript = alternative.transcript;
              } else {
                interimTranscript = alternative.transcript;
              }
              break;
            }
          }
        }

        // Fallback to first alternative if we didn't find a match
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
        const number = getMostLikelyAnswer(transcript);

        setState((prev) => ({
          ...prev,
          transcript,
          lastRecognizedNumber: number,
          confidence: bestConfidence,
        }));

        // Check if the expected answer was spoken (more lenient matching)
        const expectedAnswer = expectedAnswerRef.current;
        if (expectedAnswer !== null && onAnswerDetectedRef.current) {
          // Check if the answer appears anywhere in the transcript
          if (doesTranscriptContainAnswer(transcript, expectedAnswer)) {
            // Don't process the same transcript twice
            if (transcript !== lastProcessedTranscriptRef.current) {
              lastProcessedTranscriptRef.current = transcript;
              onAnswerDetectedRef.current(expectedAnswer, transcript);
            }
          }
        }

        // Original callback for any recognized number
        if (finalTranscript && number !== null && onResultRef.current) {
          onResultRef.current(number);
        }
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

      // Auto-restart if continuous mode and still enabled
      if (continuous && enabled && recognitionRef.current === recognition) {
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
  }, [continuous, enabled, childMode]);

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

  // Clear transcript
  const clearTranscript = useCallback(() => {
    lastProcessedTranscriptRef.current = '';
    setState((prev) => ({
      ...prev,
      transcript: '',
      lastRecognizedNumber: null,
      confidence: 0,
    }));
  }, []);

  // Reset recognition - stops and restarts to clear the buffer
  // Call this after a correct answer to start fresh
  const resetRecognition = useCallback(() => {
    lastProcessedTranscriptRef.current = '';
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      // Will auto-restart due to continuous mode in onend handler
    }
    setState((prev) => ({
      ...prev,
      transcript: '',
      lastRecognizedNumber: null,
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
    clearTranscript,
    resetRecognition,
  };
}
