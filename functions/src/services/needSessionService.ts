import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import pino from 'pino';

const logger = pino();

/**
 * NEED session state is now stored inline on the User document.
 * These helpers read/write User.activeNeedTheme and User.needPrayerIndex.
 */

/**
 * Returns the active NEED theme ID, or null if no active session.
 */
export const getActiveNeedTheme = async (phone: string): Promise<string | null> => {
  const db = getFirestore();
  const doc = await db.collection('users').doc(phone.replace('+', '')).get();
  if (!doc.exists) return null;
  const theme = doc.data()!.activeNeedTheme as string;
  return theme && theme !== '' ? theme : null;
};

/**
 * Starts a NEED session by setting activeNeedTheme and resetting the index.
 */
export const startNeedSession = async (phone: string, themeId: string): Promise<void> => {
  const db = getFirestore();
  await db.collection('users').doc(phone.replace('+', '')).update({
    activeNeedTheme: themeId,
    needPrayerIndex: 0,
    awaitingNeedSelection: false,
    updatedAt: new Date(),
  });
  logger.info({ phone, themeId }, 'NEED session started on user doc');
};

/**
 * Advances the NEED prayer index.
 */
export const advanceNeedSession = async (phone: string): Promise<void> => {
  const db = getFirestore();
  await db.collection('users').doc(phone.replace('+', '')).update({
    needPrayerIndex: FieldValue.increment(1),
    updatedAt: new Date(),
  });
};

/**
 * Clears the NEED session.
 */
export const clearNeedSession = async (phone: string): Promise<void> => {
  const db = getFirestore();
  await db.collection('users').doc(phone.replace('+', '')).update({
    activeNeedTheme: '',
    needPrayerIndex: 0,
    updatedAt: new Date(),
  });
  logger.info({ phone }, 'NEED session cleared');
};
