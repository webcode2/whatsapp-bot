import { sendWhatsAppMessage } from '../services/twilioService';
import { getPrayerCard, getNeedPrayerCard } from '../services/prayerCardService';
import { getActiveNeedTheme } from '../services/needSessionService';
import type { User } from '../types/schemas';
import pino from 'pino';

const logger = pino();

// ─────────────────────────────────────────────────────────────────────────────
// Fallback content when Firestore has no card yet
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_REFLECTION = `What is one thing God is speaking to you in this season?`;

const FALLBACK_MESSAGE = (name: string) =>
  `📖 *Today's Devotion — ${name}*\n\n` +
  `Your daily devotion content is being prepared. Stay with Him today. 🙏\n\n` +
  `_Reflect:_ ${FALLBACK_REFLECTION}\n\n` +
  `Sit with that question today. When you are ready, send *KNOCK* to make today's declaration.\n\n` +
  `• *KNOCK* — make today's declaration\n• *JOURNAL* — reflect in writing\n• *VINE* — check my growth`;

// ─────────────────────────────────────────────────────────────────────────────
// SEEK — main handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles the SEEK keyword.
 *
 * Routing logic:
 *   1. Fetch the user's journey stage card (prayerCards by stage + dayIndex).
 *   2. If the user has an active NEED session, also fetch a NEED prayer card
 *      from the active theme and append it to the message.
 *   3. No repeat guard — users may re-read at any time.
 */
export const deliverDevotion = async (
  phone: string,
  user: Partial<User> | null
): Promise<void> => {
  if (!user || !user.name) {
    await sendWhatsAppMessage(
      phone,
      `Please join ASK first by typing *ASK*. 🙏`
    );
    return;
  }

  const name = user.name;
  const stage = user.journeyStage ?? 1;
  const dayIndex = user.journeyDayIndex ?? 1;

  // ── 1. Fetch main journey prayer card ───────────────────────────────────────
  const card = await getPrayerCard(stage, dayIndex);

  let devotionMessage: string;

  if (!card) {
    // Graceful fallback — content not seeded yet
    logger.warn({ phone, stage, dayIndex }, 'No prayer card found — sending fallback');
    await sendWhatsAppMessage(phone, FALLBACK_MESSAGE(name));
    return;
  }

  devotionMessage =
    `📖 *Today's Devotion — ${name}*\n\n` +
    `_${card.verse}_\n— ${card.reference}\n\n` +
    `${card.devotionText}\n\n`;

  // ── Media links (only include if populated) ──────────────────────────────
  if (card.devotionLink) {
    devotionMessage += `🎥 *Watch / Listen:* ${card.devotionLink}\n\n`;
  }

  // ── Reflection question ──────────────────────────────────────────────────
  const reflection = card.reflectionQuestion || FALLBACK_REFLECTION;
  devotionMessage +=
    `_Reflect:_ ${reflection}\n\n` +
    `Sit with that question today. You don't need to answer it now.\n\n` +
    `When you are ready for today's declaration, send *KNOCK*.\n\n` +
    `• *KNOCK* — make today's declaration\n` +
    `• *JOURNAL* — reflect in writing\n` +
    `• *VINE* — check my growth`;

  await sendWhatsAppMessage(phone, devotionMessage);

  // ── 2. NEED prayer append — if active NEED session exists ─────────────────────
  const activeThemeId = await getActiveNeedTheme(phone);

  if (activeThemeId) {
    const needCard = await getNeedPrayerCard(
      activeThemeId,
      user.needPrayerIndex ?? 0
    );

    if (needCard) {
      const needMessage =
        `🙏 *Your NEED Prayer — "${activeThemeId}"*\n\n` +
        `_${needCard.verse}_\n\n` +
        `${needCard.prayerText}`;

      await sendWhatsAppMessage(phone, needMessage);
      logger.info(
        { phone, themeId: activeThemeId, prayerIndex: user.needPrayerIndex },
        'NEED prayer appended to SEEK'
      );
    }
  }

  logger.info({ phone, stage, dayIndex }, 'SEEK devotion delivered');
};
