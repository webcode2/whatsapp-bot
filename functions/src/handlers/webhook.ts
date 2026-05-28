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
    // In test/local mode (no project ID) we skip DB calls and just
    // return the routing decision so you can verify keyword matching end-to-end.
    const isDemoMode = (!process.env.FIREBASE_PROJECT_ID && !process.env.GOOGLE_CLOUD_PROJECT) || process.env.NODE_ENV === 'test';

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
    const { getUser, setPauseState } = await import('../services/userService');
    const { saveJournalEntry, setAwaitingJournal } = await import('../services/journalService');
    const { sendWhatsAppMessage } = await import('../services/twilioService');
    const stubs = await import('./stubHandlers');
    const db = (await import('firebase-admin/firestore')).getFirestore();

    const user = await getUser(phone);
    const normalizedText = Body.toLowerCase().replace(/[^\\w\\s]|_/g, "").trim();

    // 3. The Journal Interceptor
    if (user?.awaitingJournal) {
      if (normalizedText !== 'pause' && normalizedText !== 'resume') {
        await saveJournalEntry(user.userId, Body);
        await db.collection('users').doc(user.userId).update({ awaitingJournal: false });
        await sendWhatsAppMessage(phone, 'Thank you for sharing your heart. Your journal has been saved.');
        res.status(200).json({ status: 'ok', action: 'journal_saved' });
        return;
      }
    }

    switch (keyword) {
      case 'ask':
        await stubs.handleOnboarding(phone, user);
        break;
      case 'seek':
        await stubs.deliverDevotion(phone, user);
        break;
      case 'knock':
        await stubs.deliverDeclaration(phone, user);
        break;
      case 'journal':
        if (user) await setAwaitingJournal(user.userId);
        await sendWhatsAppMessage(phone, 'What is on your heart today? Type your journal entry below...');
        break;
      case 'vine':
        await stubs.sendVineStatus(phone, user);
        break;
      case 'need':
        await stubs.triggerNeedSelection(phone);
        break;
      case 'remind':
        await stubs.updateReminderTime(phone);
        break;
      case 'pause':
        if (user) await setPauseState(phone, true);
        await sendWhatsAppMessage(phone, 'Messages paused. Reply RESUME anytime.');
        break;
      case 'resume':
        if (user) await setPauseState(phone, false);
        await sendWhatsAppMessage(phone, 'Welcome back! Daily messages will resume. 🙌');
        break;
      case 'help':
        await sendWhatsAppMessage(phone, 'Welcome to ASK 🙏\\n\\nKeywords: ASK, SEEK, KNOCK, JOURNAL, VINE, NEED, REMIND, PAUSE, RESUME, HELP, QUEST, WATCH, LOG, QUIZ, PROGRESS');
        break;
      case 'quest':
        await stubs.handleQuestOnboarding(phone, user);
        break;
      case 'watch':
        await stubs.deliverNextVideoEarly(phone, user);
        break;
      case 'log':
        await stubs.logIndependentChapter(phone, Body);
        break;
      case 'quiz':
        await stubs.triggerWeeklyQuiz(phone, user);
        break;
      case 'progress':
        await stubs.sendQuestProgress(phone, user);
        break;
      default:
        await stubs.handleFallback(phone);
    }
    res.status(200).json({ status: 'ok', action: 'routed' });
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

  // Main inbound webhook — Twilio POSTs here.
  // Mount on both / (Cloud Function root) and /webhook (named path) to handle both call patterns.
  app.post('/', handleWebhookRequest);
  app.post('/webhook', handleWebhookRequest);

  return app;
};
