import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { determineVineStage } from '../utils/vine';
import { DateTime } from 'luxon';
import pino from 'pino';

const logger = pino();

interface StreakResult {
  incremented: boolean;
  streak: number;
  vineStage: string;
}

/**
 * Increments the user's streak once per day using a Firestore transaction.
 */
export const incrementStreak = async (userId: string, timezone: string): Promise<StreakResult> => {
  const db = getFirestore();
  const userRef = db.collection('users').doc(userId);

  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    if (!doc.exists) throw new Error('User not found');

    const data = doc.data()!;
    const nowLocal = DateTime.now().setZone(timezone);
    const lastActive = data.lastActiveDate
      ? DateTime.fromJSDate(data.lastActiveDate.toDate()).setZone(timezone)
      : null;

    const alreadyDoneToday = lastActive?.hasSame(nowLocal, 'day') && data.declarationsToday > 0;
    if (alreadyDoneToday) {
      return { incremented: false, streak: data.streak, vineStage: data.vineStage };
    }

    const newStreak = data.streak + 1;
    const newVineStage = determineVineStage(newStreak);

    transaction.update(userRef, {
      streak: newStreak,
      vineStage: newVineStage,
      lastActiveDate: new Date(),
      declarationsToday: FieldValue.increment(1),
      updatedAt: new Date(),
    });

    logger.info({ userId, newStreak, newVineStage }, 'Streak incremented');
    return { incremented: true, streak: newStreak, vineStage: newVineStage };
  });
};
