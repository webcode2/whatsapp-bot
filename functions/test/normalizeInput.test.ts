import { normalizeInput } from '../src/utils/normalizeInput';

describe('Normalize Input Utility', () => {
  it('should lowercase input', () => {
    expect(normalizeInput('HELLO WORLD')).toBe('hello world');
  });

  it('should strip punctuation', () => {
    expect(normalizeInput('hello!')).toBe('hello');
    expect(normalizeInput('join??')).toBe('join');
    expect(normalizeInput('...pray...')).toBe('pray');
    expect(normalizeInput('he_llo')).toBe('hello');
  });

  it('should collapse multiple spaces', () => {
    expect(normalizeInput('hello    world')).toBe('hello world');
    expect(normalizeInput('  hello   ')).toBe('hello');
  });

  it('should trim leading and trailing whitespace', () => {
    expect(normalizeInput('   join   ')).toBe('join');
    expect(normalizeInput('\t hello \n')).toBe('hello');
  });

  it('should return empty string for empty/null-ish input', () => {
    expect(normalizeInput('')).toBe('');
    expect(normalizeInput(null as unknown as string)).toBe('');
    expect(normalizeInput(undefined as unknown as string)).toBe('');
  });

  it('should handle mixed punctuation and whitespace', () => {
    expect(normalizeInput('  !!!JOIN...  ')).toBe('join');
    expect(normalizeInput('pray ?? please')).toBe('pray please');
  });

  it('should preserve numbers', () => {
    expect(normalizeInput('John 3:16')).toBe('john 316');
  });
});
