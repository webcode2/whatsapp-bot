import { VALID_KEYWORDS, matchKeyword } from '../services/fuzzyMatchService';

describe('Fuzzy Match Service — Comprehensive', () => {
  // ─── Exact matches ──────────────────────────────────────────────────────────

  describe('exact keyword matching', () => {
    it.each(VALID_KEYWORDS)('should match "%s" exactly (uppercase)', (keyword) => {
      expect(matchKeyword(keyword)).toBe(keyword);
    });

    it.each(VALID_KEYWORDS)('should match "%s" case-insensitively', (keyword) => {
      expect(matchKeyword(keyword.toLowerCase())).toBe(keyword);
    });

    it('should match mixed-case input', () => {
      expect(matchKeyword('JoIn')).toBe('JOIN');
      expect(matchKeyword('dEcLaRe')).toBe('DECLARE');
      expect(matchKeyword('pRaY')).toBe('PRAY');
    });
  });

  // ─── Fuzzy matching ─────────────────────────────────────────────────────────

  describe('fuzzy matching (Levenshtein distance ≤ 2)', () => {
    it('should match single-character typos', () => {
      expect(matchKeyword('JION')).toBe('JOIN');     // transposition
      expect(matchKeyword('PARY')).toBe('PRAY');     // transposition
      expect(matchKeyword('HALP')).toBe('HELP');     // single substitution
    });

    it('should match two-character typos', () => {
      expect(matchKeyword('DEKLAR')).toBe('DECLARE');
      expect(matchKeyword('JOOIN')).toBe('JOIN');
    });

    it('should NOT match when distance > 2', () => {
      expect(matchKeyword('JIOONN')).toBeNull();
      expect(matchKeyword('DEKLRRRE')).toBeNull();
      expect(matchKeyword('ABCDEF')).toBeNull();
    });
  });

  // ─── Journal entry protection ───────────────────────────────────────────────

  describe('long input protection', () => {
    it('should NOT fuzzy match long sentences (journal entries)', () => {
      expect(
        matchKeyword('I declare that God is good and I join with my family in prayer.')
      ).toBeNull();
    });

    it('should NOT match sentences > 15 characters', () => {
      expect(matchKeyword('please help me pray for strength')).toBeNull();
      expect(matchKeyword('I want to join a church group')).toBeNull();
    });

    it('should still exact-match if the cleaned input is exactly a keyword', () => {
      // "JOIN" with punctuation, after stripping = "JOIN" (4 chars, exact match)
      expect(matchKeyword('  JOIN  ')).toBe('JOIN');
      expect(matchKeyword('!!!DECLARE!!!')).toBe('DECLARE');
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      expect(matchKeyword('')).toBeNull();
    });

    it('should return null for whitespace only', () => {
      expect(matchKeyword('   ')).toBeNull();
    });

    it('should return null for punctuation only', () => {
      expect(matchKeyword('???!!!')).toBeNull();
    });

    it('should return null for numbers', () => {
      expect(matchKeyword('12345')).toBeNull();
    });

    it('should return null for emojis and unicode', () => {
      expect(matchKeyword('🙏')).toBeNull();
      expect(matchKeyword('🔥🔥🔥')).toBeNull();
    });
  });
});
