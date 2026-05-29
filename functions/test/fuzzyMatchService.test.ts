import { VALID_KEYWORDS, matchKeyword } from '../src/services/fuzzyMatchService';

describe('Fuzzy Match Service — Comprehensive', () => {
  // ─── Exact matches ──────────────────────────────────────────────────────────

  describe('exact keyword matching', () => {
    it.each(VALID_KEYWORDS)('should match "%s" exactly (lowercase)', (keyword) => {
      expect(matchKeyword(keyword)).toBe(keyword);
    });

    it.each(VALID_KEYWORDS)('should match "%s" case-insensitively (upper)', (keyword) => {
      expect(matchKeyword(keyword.toUpperCase())).toBe(keyword);
    });

    it('should match mixed-case real keywords', () => {
      expect(matchKeyword('AsK')).toBe('ask');
      expect(matchKeyword('sEeK')).toBe('seek');
      expect(matchKeyword('kNoCk')).toBe('knock');
    });
  });

  // ─── Fuzzy matching ─────────────────────────────────────────────────────────

  describe('fuzzy matching (Levenshtein distance ≤ 2)', () => {
    it('should match single-character typos', () => {
      expect(matchKeyword('aask')).toBe('ask');      // insertion
      expect(matchKeyword('halp')).toBe('help');     // substitution
      expect(matchKeyword('qiuz')).toBe('quiz');     // transposition
    });

    it('should match two-character typos', () => {
      expect(matchKeyword('proogress')).toBe('progress');  // two insertions
      expect(matchKeyword('jouurnal')).toBe('journal');    // two insertions
    });

    it('should NOT match when distance > 2', () => {
      expect(matchKeyword('jioonn')).toBeNull();
      expect(matchKeyword('deklrrre')).toBeNull();
      expect(matchKeyword('abcdef')).toBeNull();
    });
  });

  // ─── Journal entry protection ───────────────────────────────────────────────

  describe('long input protection', () => {
    it('should NOT fuzzy match long sentences (journal entries)', () => {
      expect(
        matchKeyword('I declare that God is good and I seek Him every morning.')
      ).toBeNull();
    });

    it('should NOT match sentences > 15 characters', () => {
      expect(matchKeyword('please help me pray for strength')).toBeNull();
      expect(matchKeyword('I want to ask God for wisdom today')).toBeNull();
    });

    it('should still exact-match if the cleaned input is exactly a keyword', () => {
      expect(matchKeyword('  ask  ')).toBe('ask');
      expect(matchKeyword('!!!seek!!!')).toBe('seek');
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
