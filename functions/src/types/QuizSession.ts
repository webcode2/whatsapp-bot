import type { QuestQuestion } from './QuestContent';

/**
 * quizSessions/{userId}
 *
 * Active quiz session for a user (one per user at a time).
 * Normalised out of users/ and questProgress/ (3NF): quiz state is a
 * short-lived, independent entity with its own lifecycle.
 */
export interface QuizSession {
  userId: string;
  week: number;              // which Quest week this quiz belongs to
  bookTitle: string;         // e.g. "Exodus"
  questions: QuestQuestion[];
  questionIndex: number;     // current question (0-based)
  score: number;             // correct answers so far
  startedAt: Date;
  completedAt: Date | null;
  updatedAt: Date;
}
