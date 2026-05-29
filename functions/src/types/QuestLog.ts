/**
 * users/{phone}/questLog/{YYYY-MM-DD}
 *
 * One document per day — tracks quest interactions for that calendar date.
 * Used for the PROGRESS summary and FlutterFlow activity feeds.
 */
export interface QuestLog {
  chaptersLogged: string[];   // e.g. ["Genesis 1", "Genesis 2"]
  videosWatched: string[];    // video IDs or week/index keys e.g. ["3/0", "3/1"]
  quizScore: number;          // score for a quiz completed on this day (0 if no quiz)
  quizTotal: number;          // total questions (0 if no quiz completed this day)
  quizWeek?: number;          // the week this quiz belongs to
}
