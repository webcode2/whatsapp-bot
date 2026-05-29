import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { determineVineStage } from '../utils/vine';
import { DateTime } from 'luxon';
import pino from 'pino';

const logger = pino();

interface StreakResult {
  incremented: boolean;
  streak: number;
  vineStage: string;
  declarationsToday?: number;
}

/**
 * Increments the user's streak once per day using a Firestore transaction.
 */
export const incrementStreak = async (userId: string, timezone: string, count: number = 1): Promise<StreakResult> => {
  const db = getFirestore();
  const userRef = db.collection('users').doc(userId.replace('+', ''));

  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    if (!doc.exists) throw new Error('User not found');

    const data = doc.data()!;
    const nowLocal = DateTime.now().setZone(timezone);
    const lastActive = data.lastActiveDate
      ? DateTime.fromJSDate(data.lastActiveDate.toDate()).setZone(timezone)
      : null;

    const alreadyDoneToday = lastActive?.hasSame(nowLocal, 'day') && data.declarationsToday > 0;
    
    const todayStr = DateTime.now().setZone(timezone).toISODate();
    const declRef = userRef.collection('declarations').doc(todayStr!);
    
    // Always increment declarationsToday
    transaction.update(userRef, {
      declarationsToday: FieldValue.increment(count),
      lastActiveDate: new Date(),
      updatedAt: new Date(),
    });

    transaction.set(declRef, {
      count: FieldValue.increment(count),
      timestamps: FieldValue.arrayUnion(new Date())
    }, { merge: true });

    const newDeclarationsToday = (data.declarationsToday || 0) + count;

    if (alreadyDoneToday) {
      logger.info({ userId, count }, 'Declarations logged, but streak already incremented today');
      return { incremented: false, streak: data.streak, vineStage: data.vineStage, declarationsToday: newDeclarationsToday };
    }

    const newStreak = data.streak + 1;
    const newVineStage = determineVineStage(newStreak);

    transaction.update(userRef, {
      streak: newStreak,
      vineStage: newVineStage,
    });

    logger.info({ userId, newStreak, newVineStage, count }, 'Streak incremented');
    return { incremented: true, streak: newStreak, vineStage: newVineStage, declarationsToday: newDeclarationsToday };
  });
};
