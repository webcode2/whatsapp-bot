import { getFirestore } from 'firebase-admin/firestore';
import { incrementStreak } from './streakService';
import pino from 'pino';

const logger = pino();

const MILESTONES = [7, 14, 21, 30, 60, 100];

export interface DeclarationResult {
  incremented: boolean;
  streak: number;
  vineStage: string;
  isMilestone: boolean;
}

/**
 * Handles the DECLARE flow — increments streak and logs the declaration.
 */
export const handleDeclaration = async (user: {
  userId: string;
  timezone: string;
}): Promise<DeclarationResult> => {
  const db = getFirestore();
  const { userId, timezone } = user;

  const result = await incrementStreak(userId, timezone);

  await db.collection('declarationLogs').doc().set({
    userId,
    timestamp: new Date(),
  });

  const isMilestone = result.incremented && MILESTONES.includes(result.streak);
  return { ...result, isMilestone };
};
