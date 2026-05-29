import { getFirestore } from 'firebase-admin/firestore';
import pino from 'pino';

const logger = pino();

/**
 * Saves a journal entry and clears the awaitingJournal state atomically.
 */
export const saveJournalEntry = async (userId: string, text: string): Promise<void> => {
  const db = getFirestore();
  const batch = db.batch();

  const userRef = db.collection('users').doc(userId);
  
  // Use YYYY-MM-DD as the document ID for the daily journal
  const today = new Date().toISOString().split('T')[0];
  const entryRef = userRef.collection('journal').doc(today);

  batch.set(entryRef, {
    response: text,
    timestamp: new Date(),
  }, { merge: true }); // Merge in case they update it multiple times a day

  batch.update(userRef, {
    awaitingJournal: false,
    journaledToday: true,
    lastActiveDate: new Date(),
    updatedAt: new Date(),
  });

  await batch.commit();
  logger.info({ userId, entryId: entryRef.id }, 'Journal entry saved');
};

/**
 * Sets the user into an awaiting journal state.
 */
export const setAwaitingJournal = async (userId: string): Promise<void> => {
  const db = getFirestore();
  // Use set with { merge: true } instead of update to prevent NOT_FOUND errors
  // if the user document hasn't been created yet (especially common in local testing)
  await db.collection('users').doc(userId).set({
    awaitingJournal: true,
    updatedAt: new Date(),
  }, { merge: true });
  
  logger.info({ userId }, 'User set to awaiting journal');
};
