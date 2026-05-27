import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createApp } from './handlers/webhook';

const twilioAccountSid = defineSecret('TWILIO_ACCOUNT_SID');
const twilioAuthToken = defineSecret('TWILIO_AUTH_TOKEN');
const twilioWhatsappNumber = defineSecret('TWILIO_WHATSAPP_NUMBER');

initializeApp();
setGlobalOptions({ 
  maxInstances: 10, 
  region: 'us-central1',
  secrets: [twilioAccountSid, twilioAuthToken, twilioWhatsappNumber]
});

// ── HTTP webhook — wraps the Express app in a Cloud Function ────────────────
// Twilio POSTs inbound WhatsApp messages here.
const expressApp = createApp();
export const whatsappWebhook = onRequest(expressApp);

// ── Scheduled dispatchers ───────────────────────────────────────────────────
export {
  processMorningDispatch,
  processReminderDispatch,
  reconcileStuckJobs,
} from './handlers/dispatchers';

// ── Pub/Sub workers ─────────────────────────────────────────────────────────
export { processSendWorker, processReminderWorker } from './handlers/workers';
