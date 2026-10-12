// Word List Loader
// Loads word lists from JSON files for easy editing
// The JSON files can be manually edited to add/remove words

import cvcWordsData from './cvc-words.json';
import dolchPrePrimerData from './dolch-pre-primer.json';
import firstGradeData from './first-grade.json';
import secondGradeData from './second-grade.json';
import advancedData from './advanced.json';

import type { ReadingWord } from '../../config/readingConfig';

// Type for JSON word entries (before conversion)
interface JsonWordEntry {
  word: string;
  sentence: string;
  syllables?: string[];
  pronunciations?: string[];
  difficulty?: number;
}

interface JsonWordFile {
  category: string;
  description: string;
  difficulty?: number;
  words: JsonWordEntry[];
}

// Convert JSON word entries to ReadingWord format
function convertToReadingWords(
  data: JsonWordFile,
  defaultDifficulty: 1 | 2 | 3 | 4 | 5 | 6
): ReadingWord[] {
  return data.words.map((entry) => ({
    word: entry.word,
    sentence: entry.sentence,
    syllables: entry.syllables,
    pronunciations: entry.pronunciations,
    difficulty: (entry.difficulty || defaultDifficulty) as 1 | 2 | 3 | 4 | 5 | 6,
  }));
}

// Export converted word lists
export const cvcWords: ReadingWord[] = convertToReadingWords(
  cvcWordsData as JsonWordFile,
  1
);

export const dolchPrePrimerWords: ReadingWord[] = convertToReadingWords(
  dolchPrePrimerData as JsonWordFile,
  2
);

export const dolchFirstGradeWords: ReadingWord[] = convertToReadingWords(
  firstGradeData as JsonWordFile,
  3
);

export const dolchSecondGradeWords: ReadingWord[] = convertToReadingWords(
  secondGradeData as JsonWordFile,
  4
);

export const advancedWords: ReadingWord[] = convertToReadingWords(
  advancedData as JsonWordFile,
  5 // Default, but individual entries have their own difficulty (5 or 6)
);

// Export all general words combined
export const allGeneralWords: ReadingWord[] = [
  ...cvcWords,
  ...dolchPrePrimerWords,
  ...dolchFirstGradeWords,
  ...dolchSecondGradeWords,
  ...advancedWords,
];

// Export word counts for reference
export const wordCounts = {
  cvc: cvcWords.length,
  dolchPrePrimer: dolchPrePrimerWords.length,
  firstGrade: dolchFirstGradeWords.length,
  secondGrade: dolchSecondGradeWords.length,
  advanced: advancedWords.length,
  total: allGeneralWords.length,
};

console.log('[WordLoader] Loaded word counts:', wordCounts);
