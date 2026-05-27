/**
 * Determines the vine stage based on the user's streak.
 * Stages: Grafted (1–6), Rooted (7–13), Growing (14–20), Blooming (21–29), Fruitful (30+).
 */
export const determineVineStage = (streak: number): string => {
  if (streak >= 30) return 'Fruitful';
  if (streak >= 21) return 'Blooming';
  if (streak >= 14) return 'Growing';
  if (streak >= 7) return 'Rooted';
  return 'Grafted';
};
