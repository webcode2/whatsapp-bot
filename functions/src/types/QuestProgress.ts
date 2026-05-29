/**
 * questProgress/{userId}
 *
 * Quest (video + reading) enrollment and progress.
 * Separated from users/ (3NF): quest progress is a distinct entity
 * that can be reset, paused, and queried independently of the user.
 */
export interface QuestProgress {
  userId: string;
  active: boolean;
  week: number;
  videoIndex: number;              // videos watched in the current week (0-3)
  totalChaptersLogged: number;     // cumulative chapters logged across all weeks
  quizScores: {                    // historical scores keyed by week number string
    [week: string]: {
      score: number;
      total: number;
    };
  };
  updatedAt: Date;
}
