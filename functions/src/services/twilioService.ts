import twilio from 'twilio';
import pino from 'pino';

const logger = pino();

let twilioClient: ReturnType<typeof twilio> | null = null;

const getTwilioClient = () => {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set');
    }
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
};

/**
 * Sends a WhatsApp message via Twilio.
 */
export const sendWhatsAppMessage = async (to: string, body: string): Promise<string> => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    if (!accountSid || accountSid === 'your_account_sid' || accountSid === 'mock') {
      logger.info({ to, body }, '[MOCK TWILIO] Message sent');
      return `mock_sid_${Date.now()}`;
    }

    const client = getTwilioClient();
    const from = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
    const toWhatsapp = `whatsapp:${to}`;

    const message = await client.messages.create({ body, from, to: toWhatsapp });
    logger.info({ messageSid: message.sid, to }, 'Twilio message sent');
    return message.sid;
  } catch (error) {
    logger.error({ error, to }, 'Failed to send Twilio message');
    throw error;
  }
};
