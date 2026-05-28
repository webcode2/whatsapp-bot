import { initializeApp } from 'firebase-admin/app';
import * as functions from '@google-cloud/functions-framework';
import { createApp } from './handlers/webhook';

initializeApp();

const expressApp = createApp();

// ── HTTP webhook ────────────────────────────────────────────────────────────
// Twilio POSTs inbound WhatsApp messages here.
functions.http('whatsappWebhook', expressApp);

// ── Scheduled dispatchers ───────────────────────────────────────────────────
import './handlers/dispatchers';

// ── Pub/Sub workers ─────────────────────────────────────────────────────────
import './handlers/workers';

