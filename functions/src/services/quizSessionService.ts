import { getFirestore } from 'firebase-admin/firestore';
import type { QuestQuestion } from '../types/schemas';
import pino from 'pino';

const logger = pino();

/**
 * Quiz session state is now stored inline on the User document:
 *   User.awaitingQuizAnswer       — true while a quiz is in progress
 *   User.currentQuizQuestionIndex — 0-based position in the questions array
 *   User.currentQuizScore         — correct answers so far
 *
 * Questions are re-fetched from questContent/{week} on each answer
 * (the document is static content — no write contention).
 */

export interface QuizSessionState {
  week: number;
  questionIndex: number;
  score: number;
  questions: QuestQuestion[];
  bookTitle: string;
}

/**
 * Fetches the current quiz state for a user.
 * Returns null if no active quiz.
 */
export const getQuizSession = async (phone: string): Promise<QuizSessionState | null> => {
  const db = getFirestore();

  const userDoc = await db.collection('users').doc(phone).get();
  if (!userDoc.exists) return null;

  const user = userDoc.data()!;
  if (!user.awaitingQuizAnswer) return null;

  const week = user.questWeek as number;
  const contentDoc = await db.collection('questContent').doc(String(week)).get();
  if (!contentDoc.exists) return null;

  const content = contentDoc.data()!;

  return {
    week,
    questionIndex: user.currentQuizQuestionIndex as number ?? 0,
    score: user.currentQuizScore as number ?? 0,
    questions: content.quizQuestions as QuestQuestion[],
    bookTitle: content.readingBook as string ?? content.weekTitle as string,
  };
};

/**
 * Starts a new quiz session — sets awaitingQuizAnswer and resets state on User.
 */
export const startQuizSession = async (
  phone: string,
  _week: number,
  _bookTitle: string,
  _questions: QuestQuestion[]
): Promise<QuizSessionState> => {
  const db = getFirestore();

  await db.collection('users').doc(phone).update({
    awaitingQuizAnswer: true,
    currentQuizQuestionIndex: 0,
    currentQuizScore: 0,
    updatedAt: new Date(),
  });

  // Return a state object consistent with getQuizSession shape
  return {
    week: _week,
    questionIndex: 0,
    score: 0,
    questions: _questions,
    bookTitle: _bookTitle,
  };
};

/**
 * Records an answer — increments questionIndex, conditionally increments score.
 * Returns updated state (refetched from User doc).
 */
export const recordAnswer = async (
  phone: string,
  isCorrect: boolean
): Promise<{ questionIndex: number; score: number }> => {
  const db = getFirestore();
  const userRef = db.collection('users').doc(phone);

  const doc = await userRef.get();
  const data = doc.data()!;
  const newIndex = (data.currentQuizQuestionIndex as number ?? 0) + 1;
  const newScore  = (data.currentQuizScore as number ?? 0) + (isCorrect ? 1 : 0);

  await userRef.update({
    currentQuizQuestionIndex: newIndex,
    currentQuizScore: newScore,
    updatedAt: new Date(),
  });

  logger.info({ phone, newIndex, newScore, isCorrect }, 'Quiz answer recorded');
  return { questionIndex: newIndex, score: newScore };
};

/**
 * Clears quiz state from the User document on completion or abandonment.
 */
export const clearQuizSession = async (phone: string): Promise<void> => {
  const db = getFirestore();
  await db.collection('users').doc(phone).update({
    awaitingQuizAnswer: false,
    currentQuizQuestionIndex: 0,
    currentQuizScore: 0,
    updatedAt: new Date(),
  });
  logger.info({ phone }, 'Quiz session cleared');
};
