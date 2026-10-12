// Parse spoken numbers to integers
// Handles both digit words (one, two, three) and number words (eleven, twelve, etc.)
// Optimized for children's speech patterns and common misrecognitions

const wordToNumber: Record<string, number> = {
  // Standard numbers
  zero: 0,
  oh: 0,
  o: 0,
  one: 1,
  won: 1,
  two: 2,
  to: 2,
  too: 2,
  tu: 2,
  three: 3,
  tree: 3,
  free: 3,
  four: 4,
  for: 4,
  fore: 4,
  five: 5,
  hive: 5,
  six: 6,
  siks: 6,
  sex: 6,
  seven: 7,
  sebben: 7,
  eight: 8,
  ate: 8,
  ait: 8,
  nine: 9,
  nein: 9,
  ten: 10,
  tin: 10,
  eleven: 11,
  leven: 11,
  twelve: 12,
  twelf: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  twenny: 20,
  thirty: 30,
  tirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  // Common child pronunciations
  wun: 1,
  twee: 3,
  fwee: 3,
  foh: 4,
  fiv: 5,
  seben: 7,
  nyne: 9,
};

// Handle compound numbers like "twenty one", "thirty five"
const tensWords = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function parseSpokenNumber(text: string): number | null {
  if (!text) return null;

  // Clean up the text
  const cleaned = text.toLowerCase().trim();

  // Try to parse as a direct number first
  const directNumber = parseInt(cleaned, 10);
  if (!isNaN(directNumber)) {
    return directNumber;
  }

  // Split into words
  const words = cleaned.split(/\s+/);

  // Single word number
  if (words.length === 1) {
    const num = wordToNumber[words[0]];
    return num !== undefined ? num : null;
  }

  // Try to parse compound numbers (e.g., "twenty one", "one hundred")
  let total = 0;
  let current = 0;
  let hasValidNumber = false;

  for (const word of words) {
    const num = wordToNumber[word];
    if (num === undefined) {
      // Skip "and" or other connectors
      if (word === 'and') continue;
      // If we encounter an unknown word, try to extract any numbers found so far
      if (hasValidNumber) break;
      continue;
    }

    hasValidNumber = true;

    if (num === 100) {
      // Handle hundreds
      current = (current || 1) * 100;
    } else if (tensWords.some(t => wordToNumber[t] === num)) {
      // It's a tens word
      current += num;
    } else if (num < 10) {
      // Single digit - add to current if we have a tens value
      current += num;
    } else {
      // Teen or other
      current += num;
    }
  }

  total += current;

  return hasValidNumber ? total : null;
}

// Extract all possible numbers from a transcript
export function extractNumbers(text: string): number[] {
  if (!text) return [];

  const results: number[] = [];
  const cleaned = text.toLowerCase().trim();

  // First, find any digit strings
  const digitMatches = cleaned.match(/\d+/g);
  if (digitMatches) {
    for (const match of digitMatches) {
      const num = parseInt(match, 10);
      if (!isNaN(num)) {
        results.push(num);
      }
    }
  }

  // Then try to parse the whole thing as a spoken number
  const spokenNum = parseSpokenNumber(cleaned);
  if (spokenNum !== null && !results.includes(spokenNum)) {
    results.push(spokenNum);
  }

  // Also try individual words
  const words = cleaned.split(/\s+/);
  for (const word of words) {
    const num = wordToNumber[word];
    if (num !== undefined && !results.includes(num)) {
      results.push(num);
    }
  }

  return results;
}

// Get the most likely answer from a transcript
// Optimized for math answers like "2 x 5 equals 10" or "the answer is 10"
export function getMostLikelyAnswer(text: string): number | null {
  if (!text) return null;

  const cleaned = text.toLowerCase().trim();

  // First try to parse the whole thing as a single number
  const fullParse = parseSpokenNumber(cleaned);
  if (fullParse !== null) {
    return fullParse;
  }

  // Look for answer patterns: "equals X", "is X", "= X", "answer is X"
  const answerPatterns = [
    /(?:equals?|is|=)\s*(\d+)/i,
    /(?:equals?|is|=)\s*(\w+)$/i,
    /answer\s+(?:is\s+)?(\d+)/i,
    /answer\s+(?:is\s+)?(\w+)$/i,
  ];

  for (const pattern of answerPatterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const num = parseSpokenNumber(match[1]);
      if (num !== null) {
        return num;
      }
    }
  }

  // Get all numbers from the transcript
  const numbers = extractNumbers(cleaned);

  // If there are multiple numbers, prioritize the last one
  // This handles "2 x 5 equals 10" -> returns 10
  // Also handles corrections: "three... no, four" -> returns 4
  if (numbers.length > 0) {
    return numbers[numbers.length - 1];
  }

  // Try the last few words as a fallback (for phrases like "it's ten")
  const words = cleaned.split(/\s+/);
  for (let i = words.length - 1; i >= Math.max(0, words.length - 3); i--) {
    const num = parseSpokenNumber(words[i]);
    if (num !== null) {
      return num;
    }
  }

  return null;
}

// Check if a given answer appears anywhere in the transcript
// More lenient matching for partial recognition
export function doesTranscriptContainAnswer(text: string, answer: number): boolean {
  if (!text) return false;

  const cleaned = text.toLowerCase().trim();

  // Check if the exact number appears
  if (cleaned.includes(answer.toString())) {
    return true;
  }

  // Check all extracted numbers
  const numbers = extractNumbers(cleaned);
  if (numbers.includes(answer)) {
    return true;
  }

  // Check the last few words specifically
  const words = cleaned.split(/\s+/);
  for (let i = words.length - 1; i >= Math.max(0, words.length - 4); i--) {
    const num = parseSpokenNumber(words[i]);
    if (num === answer) {
      return true;
    }
    // Also try combining last two words for compound numbers
    if (i > 0) {
      const compound = parseSpokenNumber(words[i - 1] + ' ' + words[i]);
      if (compound === answer) {
        return true;
      }
    }
  }

  return false;
}
