import { getFirestore } from 'firebase-admin/firestore';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { computeNextSendAt, computeNextReminderAt } from '../utils/timezone';
import pino from 'pino';

// Re-export User type so existing imports from userService still work
export type { User } from '../types/schemas';
import type { User } from '../types/schemas';

const logger = pino();


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

  // Derive timezone from country code — expanded mapping
  const parsed = parsePhoneNumberWithError(phone);
  const TIMEZONE_MAP: Record<string, string> = {
    NG: 'Africa/Lagos',
    GH: 'Africa/Accra',
    KE: 'Africa/Nairobi',
    ZA: 'Africa/Johannesburg',
    ET: 'Africa/Addis_Ababa',
    TZ: 'Africa/Dar_es_Salaam',
    UG: 'Africa/Kampala',
    US: 'America/New_York',
    CA: 'America/Toronto',
    BR: 'America/Sao_Paulo',
    GB: 'Europe/London',
    DE: 'Europe/Berlin',    
    FR: 'Europe/Paris',
    IN: 'Asia/Kolkata',
    PK: 'Asia/Karachi',
    BD: 'Asia/Dhaka',
    AU: 'Australia/Sydney',
  };
  const timezone = (parsed?.country && TIMEZONE_MAP[parsed.country]) || 'UTC';

  const userId = phone.replace('+', '');
  const userRef = db.collection('users').doc(userId);
  const doc = await userRef.get();

  if (doc.exists) {
    logger.info({ userId }, 'User already registered');
    return { exists: true, user: doc.data() as User };
  }

  const localTime = `${reminderHour.toString().padStart(2, '0')}:${reminderMinute.toString().padStart(2, '0')}`;
  // Compute UTC equivalent of the reminder time (HH:MM bucket used for dispatcher equality query)
  const reminderDate = new Date();
  reminderDate.setHours(reminderHour, reminderMinute, 0, 0);
  const utcHH = reminderDate.getUTCHours().toString().padStart(2, '0');
  const utcMM = reminderDate.getUTCMinutes().toString().padStart(2, '0');
  const reminderTimeUTC = `${utcHH}:${utcMM}`;

  const userData: User = {
    phone,
    name,
    timezone,
    reminderTime: localTime,
    reminderTimeLocal: localTime,
    reminderTimeUTC,
    nextSendAt: computeNextSendAt(timezone, reminderHour, reminderMinute),
    nextReminderAt: computeNextReminderAt(timezone),
    lockedUntil: null,
    streak: 0,
    vineStage: 'Grafted',
    journeyStage: 1,
    journeyDayIndex: 1,
    lastActiveDate: '',
    declarationsToday: 0,
    journaledToday: false,
    eveningReminderSentToday: false,
    lastCheckinSent: '',
    paused: false,
    awaitingJournal: false,
    awaitingNeedSelection: false,
    awaitingOnboardingStep: null,
    awaitingQuestConfirm: false,
    awaitingQuizAnswer: false,
    awaitingDeclarationYes: false,
    awaitingReminderTime: false,
    activeNeedTheme: '',
    needPrayerIndex: 0,
    questActive: false,
    questWeek: 1,
    questVideoIndex: 0,
    questChaptersLogged: 0,
    currentQuizQuestionIndex: 0,
    currentQuizScore: 0,
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await userRef.set(userData);
  logger.info({ phone }, 'New user created');
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

/**
 * Sets the awaitingOnboardingStep field to track multi-step onboarding.
 */
export const setOnboardingStep = async (
  phone: string,
  step: 'name' | 'time' | null
): Promise<void> => {
  const db = getFirestore();
  const userId = phone.replace('+', '');
  await db.collection('users').doc(userId).set(
    { awaitingOnboardingStep: step, updatedAt: new Date() },
    { merge: true }
  );
};

/**
 * Creates a minimal "pending" user document at the start of onboarding (step 0).
 * The document is completed in step 2 after name + time are collected.
 */
export const createPendingUser = async (phone: string): Promise<void> => {
  const db = getFirestore();
  const userId = phone.replace('+', '');
  await db.collection('users').doc(userId).set({
    userId,
    phone,
    awaitingOnboardingStep: 'name',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  logger.info({ userId }, 'Pending user document created');
};

/**
 * Merges arbitrary fields into an existing user document.
 */
export const updateUserFields = async (
  phone: string,
  fields: Partial<User>
): Promise<void> => {
  const db = getFirestore();
  const userId = phone.replace('+', '');
  await db.collection('users').doc(userId).update({ ...fields, updatedAt: new Date() });
};
