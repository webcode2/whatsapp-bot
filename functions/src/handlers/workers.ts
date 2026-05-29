import * as functions from '@google-cloud/functions-framework';
import { getFirestore } from 'firebase-admin/firestore';
import { sendWhatsAppMessage } from '../services/twilioService';
import { rescheduleAfterSend, rescheduleAfterReminder } from '../services/schedulingService';
import { releaseExecutionLease } from '../utils/executionLease';
import pino from 'pino';

const logger = pino();

functions.cloudEvent('processSendWorker', async (cloudEvent: any) => {
  if (!cloudEvent.data || !cloudEvent.data.message || !cloudEvent.data.message.data) return;
  const dataString = Buffer.from(cloudEvent.data.message.data, 'base64').toString('utf8');
  const data = JSON.parse(dataString);
  const userId = data.userId;
  const db = getFirestore();

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;
    const user = userDoc.data()!;

    // Fetch card by journey stage + day index
    const { getPrayerCard } = await import('../services/prayerCardService');
    const card = await getPrayerCard(user.journeyStage ?? 1, user.journeyDayIndex ?? 1);
    const msgBody = card
      ? `🌅 Good morning, ${user.name}!\n\n_${card.verse}_\n— ${card.reference}\n\n${card.devotionText}`
      : `Good morning! It's time for your daily devotional. Send *SEEK* to read today's word. 🙏`;

    await sendWhatsAppMessage(user.phone, msgBody);

    // Reschedule
    await rescheduleAfterSend(userId, user.timezone, user.reminderHour, user.reminderMinute);

  } catch (error) {
    logger.error({ userId, error }, 'Failed to process send worker');
    await releaseExecutionLease('users', userId);
  }
});

functions.cloudEvent('processReminderWorker', async (cloudEvent: any) => {
  if (!cloudEvent.data || !cloudEvent.data.message || !cloudEvent.data.message.data) return;
  const dataString = Buffer.from(cloudEvent.data.message.data, 'base64').toString('utf8');
  const data = JSON.parse(dataString);
  const userId = data.userId;
  const db = getFirestore();

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;
    const user = userDoc.data()!;

    if (user.declarationsToday === 0) {
      await sendWhatsAppMessage(user.phone, "Hey! You haven't made your declaration today. Reply DECLARE to continue your streak!");
    }

    // Reschedule
    await rescheduleAfterReminder(userId, user.timezone);

  } catch (error) {
    logger.error({ userId, error }, 'Failed to process reminder worker');
    await releaseExecutionLease('users', userId);
  }
});
