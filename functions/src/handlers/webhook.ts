import express, { Request, Response } from 'express';
import { matchKeyword } from '../services/fuzzyMatchService';
import pino from 'pino';

const logger = pino();

/**
 * Core webhook handler logic — shared between the Express local server
 * and the Cloud Function (whatsappWebhook).
 *
 * Accepts: { Body, From, ProfileName } — same shape Twilio sends.
 */
export const handleWebhookRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { Body, From, ProfileName } = req.body as {
      Body?: string;
      From?: string;
      ProfileName?: string;
    };

    if (!From || !Body) {
      res.status(400).json({ error: 'Missing From or Body' });
      return;
    }

    const phone = From.replace('whatsapp:', '');
    const keyword = matchKeyword(Body);

    logger.info({ phone, body: Body, keyword }, 'Incoming webhook');

    // ── Lazy-load Firebase-dependent services only in production ──────────────
    // In test/local mode (no FIREBASE_PROJECT_ID) we skip DB calls and just
    // return the routing decision so you can verify keyword matching end-to-end.
    const isDemoMode = !process.env.FIREBASE_PROJECT_ID || process.env.NODE_ENV === 'test';

    if (isDemoMode) {
      res.status(200).json({
        status: 'demo_mode',
        phone,
        keyword,
        message: keyword
          ? `Would handle keyword: ${keyword}`
          : 'No keyword matched — would check awaitingJournal state',
      });
      return;
    }

    // ── Production path ───────────────────────────────────────────────────────
    const { getUser, createUser, setPauseState } = await import('../services/userService');
    const { saveJournalEntry, setAwaitingJournal } = await import('../services/journalService');
    const { handleDeclaration } = await import('../services/declarationService');
    const { sendWhatsAppMessage } = await import('../services/twilioService');

    const user = await getUser(phone);

    // CRITICAL: journal state intercept — any text is a journal entry
    if (user?.awaitingJournal) {
      await saveJournalEntry(user.userId, Body);
      await sendWhatsAppMessage(phone, 'Thank you for sharing your heart. Your journal has been saved.');
      res.status(200).json({ status: 'ok', action: 'journal_saved' });
      return;
    }

    switch (keyword) {
      case 'JOIN': {
        const { exists, user: newUser } = await createUser(phone, ProfileName || 'Friend');
        const reply = exists
          ? "You're already part of ASK! Reply PRAY or DEVOTE to continue."
          : `Welcome to ASK, ${newUser.name}! You've been grafted in. Daily devotionals await you. 🌱`;
        await sendWhatsAppMessage(phone, reply);
        res.status(200).json({ status: 'ok', action: 'join', exists });
        break;
      }
      case 'PAUSE': {
        if (user) await setPauseState(phone, true);
        await sendWhatsAppMessage(phone, 'Messages paused. Reply RESUME anytime.');
        res.status(200).json({ status: 'ok', action: 'paused' });
        break;
      }
      case 'RESUME': {
        if (user) await setPauseState(phone, false);
        await sendWhatsAppMessage(phone, 'Welcome back! Daily messages will resume. 🙌');
        res.status(200).json({ status: 'ok', action: 'resumed' });
        break;
      }
      case 'JOURNAL': {
        if (user) await setAwaitingJournal(user.userId);
        await sendWhatsAppMessage(phone, 'What is on your heart today? Type your journal entry below...');
        res.status(200).json({ status: 'ok', action: 'awaiting_journal' });
        break;
      }
      case 'DECLARE': {
        if (user) {
          const result = await handleDeclaration(user);
          let msg = result.incremented
            ? `Amen! 🔥 Streak: ${result.streak} day(s) — Stage: ${result.vineStage}.`
            : "You've already declared today! See you tomorrow. 💪";
          if (result.isMilestone) msg += ` 🎉 Milestone unlocked at ${result.streak} days!`;
          await sendWhatsAppMessage(phone, msg);
        }
        res.status(200).json({ status: 'ok', action: 'declared' });
        break;
      }
      default: {
        await sendWhatsAppMessage(
          phone,
          'Welcome to ASK 🙏\n\nKeywords: JOIN · PRAY · DEVOTE · DECLARE · JOURNAL · STREAK · REMIND · PAUSE · RESUME · HELP'
        );
        res.status(200).json({ status: 'ok', action: 'help_sent' });
      }
    }
  } catch (error) {
    logger.error(error, 'Webhook handler error');
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Creates and returns a configured Express app with the webhook route mounted.
 * Used by both the local dev server and tests.
 */
export const createApp = (): express.Application => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true })); // Twilio sends URL-encoded bodies

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'ASK WhatsApp Bot' }));

  // Main inbound webhook — Twilio POSTs here
  app.post('/webhook', handleWebhookRequest);

  return app;
};
