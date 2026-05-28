import * as functions from '@google-cloud/functions-framework';
import { getFirestore } from 'firebase-admin/firestore';
import { claimExecutionLease } from '../utils/executionLease';
import { safePubSubPublish } from '../utils/pubsub';
import pino from 'pino';

const logger = pino();
const MORNING_TOPIC = process.env.PUBSUB_TOPIC_MORNING_SEND || 'morning-send-topic';
const REMINDER_TOPIC = process.env.PUBSUB_TOPIC_REMINDER_SEND || 'reminder-send-topic';

functions.cloudEvent('processMorningDispatch', async (cloudEvent: any) => {
  const db = getFirestore();
  const now = new Date();

  const snapshot = await db.collection('users')
    .where('paused', '==', false)
    .where('nextSendAt', '<=', now)
    .get();

  for (const doc of snapshot.docs) {
    const claimed = await claimExecutionLease('users', doc.id);
    if (claimed) {
      await safePubSubPublish(MORNING_TOPIC, { userId: doc.id });
      logger.info({ userId: doc.id }, 'Dispatched morning job to Pub/Sub');
    }
  }
});

functions.cloudEvent('processReminderDispatch', async (cloudEvent: any) => {
  const db = getFirestore();
  const now = new Date();

  const snapshot = await db.collection('users')
    .where('paused', '==', false)
    .where('nextReminderAt', '<=', now)
    .get();

  for (const doc of snapshot.docs) {
    const claimed = await claimExecutionLease('users', doc.id);
    if (claimed) {
      await safePubSubPublish(REMINDER_TOPIC, { userId: doc.id });
      logger.info({ userId: doc.id }, 'Dispatched reminder job to Pub/Sub');
    }
  }
});

functions.cloudEvent('reconcileStuckJobs', async (cloudEvent: any) => {
  const db = getFirestore();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const snapshot = await db.collection('users')
    .where('lockedUntil', '<=', tenMinutesAgo)
    .get();

  let count = 0;
  for (const doc of snapshot.docs) {
    await doc.ref.update({ lockedUntil: null, updatedAt: new Date() });
    count++;
  }
  
  if (count > 0) {
    logger.info({ count }, 'Reconciled stuck jobs');
  }
});
