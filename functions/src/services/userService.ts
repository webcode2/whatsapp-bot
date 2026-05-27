import { getFirestore } from 'firebase-admin/firestore';
import { parsePhoneNumber } from 'libphonenumber-js';
import { computeNextSendAt, computeNextReminderAt } from '../utils/timezone';
import pino from 'pino';

const logger = pino();

export interface User {
  userId: string;
  phone: string;
  name: string;
  timezone: string;
  reminderHour: number;
  reminderMinute: number;
  nextSendAt: Date;
  nextReminderAt: Date;
  streak: number;
  vineStage: string;
  joinedAt: Date;
  lastActiveDate: Date | null;
  declarationsToday: number;
  journaledToday: boolean;
  paused: boolean;
  awaitingJournal: boolean;
  lockedUntil: Date | null;
  lastSentAt: Date | null;
  reminderSentToday: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates a new user. Returns {exists: true} if the phone is already registered.
 */
export const createUser = async (
  phone: string,
  name: string,
  reminderHour = 8,
  reminderMinute = 0
): Promise<{ exists: boolean; user: Partial<User> }> => {
  const db = getFirestore();

  // Derive timezone from country code — defaulting to UTC when unmappable
  const parsed = parsePhoneNumber(phone);
  const timezone = parsed?.country === 'NG' ? 'Africa/Lagos'
    : parsed?.country === 'US' ? 'America/New_York'
    : parsed?.country === 'IN' ? 'Asia/Kolkata'
    : 'UTC';

  const userId = phone.replace('+', '');
  const userRef = db.collection('users').doc(userId);
  const doc = await userRef.get();

  if (doc.exists) {
    logger.info({ userId }, 'User already registered');
    return { exists: true, user: doc.data() as User };
  }

  const userData: User = {
    userId,
    phone,
    name,
    timezone,
    reminderHour,
    reminderMinute,
    nextSendAt: computeNextSendAt(timezone, reminderHour, reminderMinute),
    nextReminderAt: computeNextReminderAt(timezone),
    streak: 0,
    vineStage: 'Grafted',
    joinedAt: new Date(),
    lastActiveDate: null,
    declarationsToday: 0,
    journaledToday: false,
    paused: false,
    awaitingJournal: false,
    lockedUntil: null,
    lastSentAt: null,
    reminderSentToday: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await userRef.set(userData);
  logger.info({ userId }, 'New user created');
  return { exists: false, user: userData };
};

/**
 * Retrieves a user by phone number.
 */
export const getUser = async (phone: string): Promise<User | null> => {
  const db = getFirestore();
  const userId = phone.replace('+', '');
  const doc = await db.collection('users').doc(userId).get();
  return doc.exists ? (doc.data() as User) : null;
};

/**
 * Pauses or resumes messaging for a user.
 */
export const setPauseState = async (phone: string, paused: boolean): Promise<void> => {
  const db = getFirestore();
  const userId = phone.replace('+', '');
  await db.collection('users').doc(userId).update({ paused, updatedAt: new Date() });
};
