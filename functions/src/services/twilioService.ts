import twilio from 'twilio';
import pino from 'pino';

const logger = pino();

let twilioClient: ReturnType<typeof twilio> | null = null;

const getTwilioClient = () => {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    }
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
};

const isMock = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  return !sid || sid === 'your_account_sid' || sid === 'mock';
};

// ─────────────────────────────────────────────────────────────────────────────
// Plain text message
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a plain WhatsApp message via Twilio.
 */
export const sendWhatsAppMessage = async (to: string, body: string): Promise<string> => {
  try {
    if (isMock()) {
      logger.info({ to, body }, '[MOCK TWILIO] sendWhatsAppMessage');
      return `mock_sid_${Date.now()}`;
    }

    const client = getTwilioClient();
    const from      = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
    const toAddress = `whatsapp:${to}`;

    const message = await client.messages.create({ body, from, to: toAddress });
    logger.info({ messageSid: message.sid, to }, 'Twilio message sent');
    return message.sid;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send Twilio message');
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Interactive quick-reply (3 buttons — used for quiz questions)
// ─────────────────────────────────────────────────────────────────────────────

export interface QuizButtonPayload {
  questionNumber: number;  // 1-based, shown in header
  totalQuestions: number;
  bookTitle: string;
  questionText: string;
  options: [string, string, string];  // exactly A, B, C
}

/**
 * Sends an interactive quick-reply message with 3 clickable option buttons.
 *
 * Requires TWILIO_CONTENT_SID_QUIZ to be set to a pre-created
 * twilio/quick-reply content template SID (HXxxx…).
 *
 * Template variables:
 *   {{1}} — header line (e.g. "Week 3 Quiz — Exodus | Question 2 of 4")
 *   {{2}} — question text
 *   {{3}} — option A text
 *   {{4}} — option B text
 *   {{5}} — option C text
 *
 * Falls back to plain text if the content SID is not configured.
 */
export const sendQuizQuestion = async (
  to: string,
  payload: QuizButtonPayload
): Promise<string> => {
  const contentSid = process.env.TWILIO_CONTENT_SID_QUIZ;

  // ── Fallback: plain text with A/B/C labels ────────────────────────────────
  if (isMock() || !contentSid) {
    const { questionNumber, totalQuestions, bookTitle, questionText, options } = payload;
    const fallback =
      `*${bookTitle} — Question ${questionNumber} of ${totalQuestions}*\n\n` +
      `${questionText}\n\n` +
      `A — ${options[0]}\n` +
      `B — ${options[1]}\n` +
      `C — ${options[2]}\n\n` +
      `_Reply A, B or C_`;
    logger.info({ to }, '[MOCK/FALLBACK] sendQuizQuestion — no contentSid, using text');
    return sendWhatsAppMessage(to, fallback);
  }

  // ── Interactive quick-reply via Content API ───────────────────────────────
  try {
    const client = getTwilioClient();
    const from      = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
    const toAddress = `whatsapp:${to}`;

    const header = `${payload.bookTitle} — Question ${payload.questionNumber} of ${payload.totalQuestions}`;

    const message = await client.messages.create({
      from,
      to: toAddress,
      contentSid,
      contentVariables: JSON.stringify({
        '1': header,
        '2': payload.questionText,
        '3': `A — ${payload.options[0]}`,
        '4': `B — ${payload.options[1]}`,
        '5': `C — ${payload.options[2]}`,
      }),
    } as any); // Twilio SDK typings lag behind Content API support

    logger.info({ messageSid: message.sid, to }, 'Quiz question sent (interactive)');
    return message.sid;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send interactive quiz question — falling back to text');
    // Graceful degradation
    const { questionNumber, totalQuestions, bookTitle, questionText, options } = payload;
    const fallback =
      `*${bookTitle} — Question ${questionNumber} of ${totalQuestions}*\n\n` +
      `${questionText}\n\n` +
      `A — ${options[0]}\n` +
      `B — ${options[1]}\n` +
      `C — ${options[2]}\n\n` +
      `_Reply A, B or C_`;
    return sendWhatsAppMessage(to, fallback);
  }
};
