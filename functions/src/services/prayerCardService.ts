import { getFirestore } from 'firebase-admin/firestore';
import type { PrayerCard } from '../types/PrayerCard';
import type { ThemePrayer } from '../types/ThemePrayer';
import pino from 'pino';

export type { PrayerCard };

const logger = pino();

/**
 * Fetches the prayer card for a given journey stage and day index.
 * Used by SEEK and the morning dispatch worker.
 *
 * Collection path: prayerCards/{id}
 * Query: journeyStage == stage AND dayIndex == day
 */
export const getPrayerCard = async (
  stage: number,
  day: number
): Promise<PrayerCard | null> => {
  const db = getFirestore();
  const snapshot = await db
    .collection('prayerCards')
    .where('journeyStage', '==', stage)
    .where('dayIndex', '==', day)
    .limit(1)
    .get();

  if (snapshot.empty) {
    logger.warn({ stage, day }, 'No prayer card found for stage/day');
    return null;
  }

  return snapshot.docs[0].data() as PrayerCard;
};

/**
 * Legacy helper — fetches by flat "day" number (streak-based).
 * Kept for backward compatibility with workers.ts until migrated.
 * @deprecated Use getPrayerCard(stage, dayIndex) instead.
 */
export const getPrayerCardForDay = async (day: number): Promise<PrayerCard | null> => {
  const db = getFirestore();
  const snapshot = await db
    .collection('prayerCards')
    .where('dayIndex', '==', day)
    .limit(1)
    .get();

  if (snapshot.empty) {
    logger.warn({ day }, 'No prayer card found for day');
    return null;
  }

  return snapshot.docs[0].data() as PrayerCard;
};

/**
 * Fetches a NEED prayer from prayerThemes/{themeId}/prayers sub-collection by index.
 * Returns ThemePrayer or null if not found.
 */
export const getNeedPrayerCard = async (
  themeId: string,
  prayerIndex: number
): Promise<ThemePrayer | null> => {
  const db = getFirestore();
  const snapshot = await db
    .collection('prayerThemes')
    .doc(themeId)
    .collection('prayers')
    .where('index', '==', prayerIndex)
    .limit(1)
    .get();

  if (snapshot.empty) {
    logger.warn({ themeId, prayerIndex }, 'No NEED prayer found in prayerThemes sub-collection');
    return null;
  }

  return snapshot.docs[0].data() as ThemePrayer;
};
