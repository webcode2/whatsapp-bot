/**
 * Normalizes input text by lowercasing, stripping punctuation, and collapsing spaces.
 */
export const normalizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/[^\w\s]|_/g, '') // strip punctuation
    .replace(/\s+/g, ' ')      // collapse spaces
    .trim();
};
