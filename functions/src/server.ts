/**
 * Local development server for the ASK WhatsApp Bot.
 *
 * Runs a plain Express HTTP server so you can test the webhook with curl
 * or any HTTP client — no Firebase emulator or Java required.
 *
 * Usage:
 *   yarn dev
 *
 * Test:
 *   curl -X POST http://localhost:3000/webhook \
 *     -H "Content-Type: application/json" \
 *     -d '{"From":"whatsapp:+2348012345678","Body":"JOIN","ProfileName":"Tunde"}'
 */

import { createApp } from './handlers/webhook';
import { initializeApp } from 'firebase-admin/app';
import pino from 'pino';

const logger = pino();
const PORT = parseInt(process.env.PORT || '3000', 10);

if (process.env.FIREBASE_PROJECT_ID) {
  initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
  logger.info(`🔥 Firebase initialized with project: ${process.env.FIREBASE_PROJECT_ID}`);
}

const app = createApp();

app.listen(PORT, () => {
  logger.info({ port: PORT }, '🚀 ASK Bot local server running');
  logger.info(`   Health:  http://localhost:${PORT}/health`);
  logger.info(`   Webhook: POST http://localhost:${PORT}/webhook`);
  logger.info('');
  logger.info('Example curl test:');
  logger.info(`  curl -X POST http://localhost:${PORT}/webhook \\`);
  logger.info(`    -H "Content-Type: application/json" \\`);
  logger.info(`    -d \'{"From":"whatsapp:+2348012345678","Body":"JOIN","ProfileName":"Tunde"}\'`);
});
