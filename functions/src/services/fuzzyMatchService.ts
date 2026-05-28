import { distance } from 'fastest-levenshtein';
import { normalizeInput } from '../utils/normalizeInput';

export const VALID_KEYWORDS = [
  'ask', 'seek', 'knock', 'journal', 'vine', 
  'need', 'remind', 'pause', 'resume', 'help', 
  'quest', 'watch', 'log', 'quiz', 'progress'
];

/**
 * Matches an input string against valid keywords using exact and fuzzy matching.
 * Returns the matched keyword or null if no match found.
 */
export const matchKeyword = (input: string): string | null => {
  const normalized = normalizeInput(input);

  if (!normalized) return null;

  // 1. Exact match first
  if (VALID_KEYWORDS.includes(normalized)) {
    return normalized;
  }

  // 2. Fuzzy match — only for short inputs to avoid treating journal entries as typos
  if (normalized.length <= 15) {
    let bestMatch: string | null = null;
    let minDistance = Infinity;

    for (const keyword of VALID_KEYWORDS) {
      const dist = distance(normalized, keyword);
      if (dist <= 2 && dist < minDistance) {
        minDistance = dist;
        bestMatch = keyword;
      }
    }

    if (bestMatch) return bestMatch;
  }

  return null;
};
