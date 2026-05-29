/**
 * Determines the vine stage based on the user's streak.
 * Stages: Grafted (1–6), Rooted (7–20), Growing (21–41), Blooming (42–69), Fruitful (70+).
 */
export const determineVineStage = (streak: number): string => {
  if (streak >= 70) return 'Fruitful';
  if (streak >= 42) return 'Blooming';
  if (streak >= 21) return 'Growing';
  if (streak >= 7) return 'Rooted';
  return 'Grafted';
};
