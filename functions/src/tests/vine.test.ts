import { determineVineStage } from '../utils/vine';

describe('Vine Stage Utility', () => {
  it('should return "Grafted" for streaks 0–6', () => {
    expect(determineVineStage(0)).toBe('Grafted');
    expect(determineVineStage(1)).toBe('Grafted');
    expect(determineVineStage(6)).toBe('Grafted');
  });

  it('should return "Rooted" for streaks 7–13', () => {
    expect(determineVineStage(7)).toBe('Rooted');
    expect(determineVineStage(10)).toBe('Rooted');
    expect(determineVineStage(13)).toBe('Rooted');
  });

  it('should return "Growing" for streaks 14–20', () => {
    expect(determineVineStage(14)).toBe('Growing');
    expect(determineVineStage(17)).toBe('Growing');
    expect(determineVineStage(20)).toBe('Growing');
  });

  it('should return "Blooming" for streaks 21–29', () => {
    expect(determineVineStage(21)).toBe('Blooming');
    expect(determineVineStage(25)).toBe('Blooming');
    expect(determineVineStage(29)).toBe('Blooming');
  });

  it('should return "Fruitful" for streaks 30+', () => {
    expect(determineVineStage(30)).toBe('Fruitful');
    expect(determineVineStage(100)).toBe('Fruitful');
    expect(determineVineStage(365)).toBe('Fruitful');
  });

  // Edge: exact boundaries
  it('should handle exact boundary transitions', () => {
    expect(determineVineStage(6)).toBe('Grafted');
    expect(determineVineStage(7)).toBe('Rooted');
    expect(determineVineStage(13)).toBe('Rooted');
    expect(determineVineStage(14)).toBe('Growing');
    expect(determineVineStage(20)).toBe('Growing');
    expect(determineVineStage(21)).toBe('Blooming');
    expect(determineVineStage(29)).toBe('Blooming');
    expect(determineVineStage(30)).toBe('Fruitful');
  });
});
