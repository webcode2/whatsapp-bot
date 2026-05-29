import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import pino from 'pino';

const logger = pino();

/**
 * Quest progress is now inlined on the User document.
 * These helpers read/write questActive, questWeek, questVideoIndex, questChaptersLogged.
 *
 * Quiz scores are persisted to the questLog sub-collection:
 *   users/{phone}/questLog/{YYYY-MM-DD}
 */

export const getQuestProgress = async (phone: string) => {
  const db = getFirestore();
  const doc = await db.collection('users').doc(phone).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  return {
    active: data.questActive as boolean,
    week: data.questWeek as number,
    videoIndex: data.questVideoIndex as number,
    chaptersLogged: data.questChaptersLogged as number,
  };
};

export const startQuest = async (phone: string): Promise<void> => {
  const db = getFirestore();
  await db.collection('users').doc(phone).update({
    questActive: true,
    questWeek: 1,
    questVideoIndex: 0,
    questChaptersLogged: 0,
    awaitingQuestConfirm: false,
    updatedAt: new Date(),
  });
  logger.info({ phone }, 'Quest started');
};

export const advanceQuestVideo = async (phone: string): Promise<void> => {
  const db = getFirestore();
  await db.collection('users').doc(phone).update({
    questVideoIndex: FieldValue.increment(1),
    updatedAt: new Date(),
  });
};

export const advanceQuestWeek = async (phone: string): Promise<void> => {
  const db = getFirestore();
  await db.collection('users').doc(phone).update({
    questWeek: FieldValue.increment(1),
    questVideoIndex: 0,
    updatedAt: new Date(),
  });
  logger.info({ phone }, 'Quest week advanced');
};

export const logIndependentChapter = async (phone: string, chapterName: string): Promise<{ totalChapters: number }> => {
  const db = getFirestore();
  const today = new Date().toISOString().split('T')[0];
  const userRef = db.collection('users').doc(phone);
  const logRef = userRef.collection('questLog').doc(today);

  const batch = db.batch();

  // Increment total counter on User doc
  batch.update(userRef, {
    questChaptersLogged: FieldValue.increment(1),
    updatedAt: new Date(),
  });

  // Push to today's log array
  batch.set(logRef, {
    chaptersLogged: FieldValue.arrayUnion(chapterName)
  }, { merge: true });

  await batch.commit();

  // Fetch updated total
  const doc = await userRef.get();
  return { totalChapters: doc.data()?.questChaptersLogged as number ?? 1 };
};

/**
 * Records a completed quiz score to the questLog sub-collection.
 */
export const recordQuizScore = async (
  phone: string,
  week: number,
  score: number,
  total: number
): Promise<void> => {
  const db = getFirestore();
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  await db
    .collection('users')
    .doc(phone)
    .collection('questLog')
    .doc(today)
    .set({ quizScore: score, quizTotal: total, quizWeek: week }, { merge: true });
  logger.info({ phone, week, score, total }, 'Quiz score recorded to questLog');
};
