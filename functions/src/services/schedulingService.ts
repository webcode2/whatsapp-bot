import { getFirestore } from 'firebase-admin/firestore';
import { computeNextSendAt, computeNextReminderAt } from '../utils/timezone';
import pino from 'pino';

const logger = pino();

/**
 * Reschedules the next send timestamp after a successful morning dispatch.
 */
export const rescheduleAfterSend = async (
  userId: string,
  timezone: string,
  reminderHour: number,
  reminderMinute: number
): Promise<void> => {
  const db = getFirestore();
  const nextSendAt = computeNextSendAt(timezone, reminderHour, reminderMinute);

  await db.collection('users').doc(userId).update({
    nextSendAt,
    lockedUntil: null,
    lastSentAt: new Date(),
    updatedAt: new Date(),
  });

  logger.info({ userId, nextSendAt }, 'Rescheduled morning dispatch');
};

/**
 * Reschedules the next reminder timestamp after a successful reminder dispatch.
 */
export const rescheduleAfterReminder = async (userId: string, timezone: string): Promise<void> => {
  const db = getFirestore();
  const nextReminderAt = computeNextReminderAt(timezone);

  await db.collection('users').doc(userId).update({
    nextReminderAt,
    reminderSentToday: true,
    lockedUntil: null,
    updatedAt: new Date(),
  });

  logger.info({ userId, nextReminderAt }, 'Rescheduled reminder dispatch');
};
