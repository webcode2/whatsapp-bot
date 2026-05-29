import { determineVineStage } from '../src/utils/vine';

describe('Vine Stage Utility', () => {
  it('should return "Grafted" for streaks 0–6', () => {
    expect(determineVineStage(0)).toBe('Grafted');
    expect(determineVineStage(1)).toBe('Grafted');
    expect(determineVineStage(6)).toBe('Grafted');
  });

  it('should return "Rooted" for streaks 7–20', () => {
    expect(determineVineStage(7)).toBe('Rooted');
    expect(determineVineStage(14)).toBe('Rooted');
    expect(determineVineStage(20)).toBe('Rooted');
  });

  it('should return "Growing" for streaks 21–41', () => {
    expect(determineVineStage(21)).toBe('Growing');
    expect(determineVineStage(30)).toBe('Growing');
    expect(determineVineStage(41)).toBe('Growing');
  });

  it('should return "Blooming" for streaks 42–69', () => {
    expect(determineVineStage(42)).toBe('Blooming');
    expect(determineVineStage(55)).toBe('Blooming');
    expect(determineVineStage(69)).toBe('Blooming');
  });

  it('should return "Fruitful" for streaks 70+', () => {
    expect(determineVineStage(70)).toBe('Fruitful');
    expect(determineVineStage(100)).toBe('Fruitful');
    expect(determineVineStage(365)).toBe('Fruitful');
  });

  // Edge: exact boundaries
  it('should handle exact boundary transitions', () => {
    expect(determineVineStage(6)).toBe('Grafted');
    expect(determineVineStage(7)).toBe('Rooted');
    expect(determineVineStage(20)).toBe('Rooted');
    expect(determineVineStage(21)).toBe('Growing');
    expect(determineVineStage(41)).toBe('Growing');
    expect(determineVineStage(42)).toBe('Blooming');
    expect(determineVineStage(69)).toBe('Blooming');
    expect(determineVineStage(70)).toBe('Fruitful');
  });
});
