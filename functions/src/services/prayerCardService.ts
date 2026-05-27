import { getFirestore } from 'firebase-admin/firestore';
import pino from 'pino';

const logger = pino();

export interface PrayerCard {
  day: number;
  verse: string;
  reference: string;
  focus: string;
  reflection: string;
  devotionPassage: string;
  devotionChapter: string;
  reflectionQuestion: string;
  journalPrompt: string;
}

/**
 * Fetches a prayer card for a specific day.
 * @param day The day number
 * @returns The PrayerCard object or null
 */
export const getPrayerCardForDay = async (day: number): Promise<PrayerCard | null> => {
  const db = getFirestore();
  const snapshot = await db.collection('prayerCards').where('day', '==', day).limit(1).get();

  if (snapshot.empty) {
    logger.warn({ day }, 'No prayer card found for day');
    return null;
  }

  return snapshot.docs[0].data() as PrayerCard;
};
