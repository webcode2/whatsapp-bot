import * as functions from '@google-cloud/functions-framework';
import { getFirestore } from 'firebase-admin/firestore';
import { sendWhatsAppMessage } from '../services/twilioService';
import { rescheduleAfterSend, rescheduleAfterReminder } from '../services/schedulingService';
import { releaseExecutionLease } from '../utils/executionLease';
import { getPrayerCardForDay } from '../services/prayerCardService';
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

    // Send the morning devotional (For demo, we'll send day 1 or streak + 1)
    const card = await getPrayerCardForDay(user.streak + 1);
    const msgBody = card 
      ? `Morning! Here's your devotional:\n\n${card.verse} - ${card.reference}\n\n${card.devotionPassage}`
      : "Good morning! It's time for your daily devotional.";

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
