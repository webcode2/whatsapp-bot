import { sendWhatsAppMessage } from '../services/twilioService';
import {
  createPendingUser,
  setOnboardingStep,
  updateUserFields,
  createUser,
  User,
} from '../services/userService';
import { parseTime } from '../utils/timeParser';
import { parsePhoneNumber } from 'libphonenumber-js';
import { computeNextSendAt, computeNextReminderAt, computeUserScheduleFields } from '../utils/timezone';
import pino from 'pino';

const logger = pino();

// Journey image URL from env — set in GCP Secret Manager / .env
const JOURNEY_IMAGE_URL = process.env.JOURNEY_IMAGE_URL || '';

// ─────────────────────────────────────────────────────────────────────────────
// Step 0 — User texts "ASK"
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entry point for the onboarding flow.
 * - If user already exists: sends their current vine stage + streak (duplicate guard).
 * - If new: creates a pending Firestore doc and sends the welcome message.
 */
export const handleOnboarding = async (phone: string, user: Partial<User> | null): Promise<void> => {
  // Duplicate guard — user already registered
  if (user && user.awaitingOnboardingStep === null || (user && user.name)) {
    const name = user.name || 'Friend';
    const stage = user.vineStage || 'Grafted';
    const streak = user.streak ?? 0;
    await sendWhatsAppMessage(
      phone,
      `You are already planted, ${name}. Your vine is *${stage}* — Streak: ${streak} day${streak === 1 ? '' : 's'}. Reply HELP to see your options.`
    );
    logger.info({ phone, stage, streak }, 'Duplicate ASK — returning vine status');
    return;
  }

  // New user — create pending doc and send welcome
  await createPendingUser(phone);

  await sendWhatsAppMessage(
    phone,
    `You have just done something significant.\n\nWelcome to ASK — a daily space to Ask, Seek and Knock in the presence of God. Every morning I will meet you here with a word, a prayer and a declaration. Our goal is to walk together towards a tightly knit relationship with the Holy Spirit. One day at a time.\n\n_Always remember: In consistency lies the power._\n\nBefore we begin, may I know your name?`
  );

  logger.info({ phone }, 'Onboarding started — awaiting name');
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — User replies with their name
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Captures the user's name, stores it, advances to the time-selection step.
 */
export const handleNameReply = async (phone: string, rawText: string): Promise<void> => {
  // Capitalize first letter of each word
  const name = rawText
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Save name and advance onboarding step
  await updateUserFields(phone, { name } as Partial<User>);
  await setOnboardingStep(phone, 'time');

  await sendWhatsAppMessage(
    phone,
    `${name}. Beautiful.\n\nGod knew that name before you did. I am going to walk with you every day, ${name}.\n\nEvery morning your prayer card arrives. If you haven't completed your movement by 8:00 PM I will send a gentle reminder. That is all I will ever send — unless you ask for more.\n\nWhat time would you like your morning card? _(e.g. 6am, 7:30, 18:00 — default is 6:00 AM)_`
  );

  logger.info({ phone, name }, 'Onboarding name captured — awaiting time');
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — User replies with their preferred time
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Captures the user's preferred reminder time, derives their timezone,
 * finalises the Firestore user document, and sends the journey welcome messages.
 */
export const handleTimeReply = async (phone: string, rawText: string): Promise<void> => {
  // Allow "skip" or empty to default to 6:00 AM
  const isDefault = rawText.trim().toLowerCase() === 'skip' || rawText.trim() === '';
  const parsed = isDefault ? { hour: 6, minute: 0, display: '06:00' } : parseTime(rawText);

  if (!parsed) {
    await sendWhatsAppMessage(
      phone,
      `Sorry, I didn't quite catch that. Please try a format like:\n*6am*, *8:30*, *18:00*\n\nOr type *skip* to use the default (6:00 AM).`
    );
    return; // Stay on 'time' step — don't advance
  }

  const scheduleFields = computeUserScheduleFields(phone, parsed.hour, parsed.minute, parsed.display);

  // Finalise the user document via createUser (idempotent — merges over pending doc)
  await createUser(phone, '', parsed.hour, parsed.minute);

  // Override with actual values from onboarding (name was stored in step 1)
  await updateUserFields(phone, {
    ...scheduleFields,
    journeyStage: 1,
    vineStage: 'Grafted',
    streak: 0,
    paused: false,
    awaitingOnboardingStep: null,
  } as Partial<User>);

  logger.info({ phone, timezone: scheduleFields.timezone, localTime: scheduleFields.reminderTimeLocal }, 'Onboarding complete — scheduling finalised');

  // ── Send Journey Stage 1 (Believe) Welcome ──────────────────────────────────
  await sendWhatsAppMessage(
    phone,
    `Everyday, I will be here. No matter what the day holds, I will show up if you show up.\n\nHere is what to expect. Our first ASK devotion is a journey through nine seasons of fellowship with God, each one taking you deeper into a closer walk with God and a stronger prayer walk.\n\nWe start at *Believe* and journey to *Reign*.\n\n_"He that cometh to God must know that He Is, and that He is a rewarder of those who diligently seek Him."_`
  );

  // Send Journey image if URL is configured
  if (JOURNEY_IMAGE_URL) {
    const twilioClient = (await import('../services/twilioService')).sendWhatsAppMessage;
    // Re-send with media — Twilio handles MMS when mediaUrl is provided
    // For now, send image URL inline until media-send is wired up
    await sendWhatsAppMessage(phone, JOURNEY_IMAGE_URL);
  }

  // ── Journey Welcome — Message 2 ─────────────────────────────────────────
  await sendWhatsAppMessage(
    phone,
    `We begin at Season 1 *Believe*.\n\nHowever, if your heart has a specific prayer need at any time — healing, provision, a waiting season — simply type *NEED* at any time and I will bring you targeted prayers alongside your journey.\n\nYou are *Grafted* on Day 1. Your first morning card arrives tomorrow at ${scheduleFields.reminderTimeLocal}. When it does, please read it slowly. Then type *SEEK* when you are ready to go deeper. Type *KNOCK* to make your declaration. Together we will Ask, Seek and Knock every day.\n\nI will see you tomorrow morning. 🙏\n\n_SEEK — get today's word now_\n_NEED — browse prayer themes_\n_HELP — see all I can do_`
  );
};
