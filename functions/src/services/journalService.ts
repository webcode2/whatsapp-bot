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
  const entryRef = db.collection('journalEntries').doc();

  batch.set(entryRef, {
    userId,
    response: text,
    timestamp: new Date(),
  });

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
  await db.collection('users').doc(userId).update({
    awaitingJournal: true,
    updatedAt: new Date(),
  });
  logger.info({ userId }, 'User set to awaiting journal');
};
