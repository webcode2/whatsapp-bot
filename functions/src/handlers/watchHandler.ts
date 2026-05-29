import { sendWhatsAppMessage } from '../services/twilioService';
import { getQuestProgress, advanceQuestVideo } from '../services/questProgressService';
import { getFirestore } from 'firebase-admin/firestore';
import type { User, QuestContent } from '../types/schemas';
import pino from 'pino';

const logger = pino();

export const deliverNextVideoEarly = async (
  phone: string,
  user: Partial<User> | null
): Promise<void> => {
  if (!user || !user.questActive) {
    await sendWhatsAppMessage(
      phone,
      `You haven't started a Quest yet! Type *QUEST* to begin your journey through the Bible.`
    );
    return;
  }

  const existing = await getQuestProgress(phone);
  if (!existing || !existing.active) {
    await sendWhatsAppMessage(
      phone,
      `You haven't started a Quest yet! Type *QUEST* to begin your journey through the Bible.`
    );
    return;
  }

  const week = existing.week;
  const currentVideoIndex = existing.videoIndex;

  if (currentVideoIndex >= 3) {
    await sendWhatsAppMessage(
      phone,
      `You have watched all the videos for Week ${week}! Your next video arrives on Monday.`
    );
    return;
  }

  const db = getFirestore();
  const contentDoc = await db.collection('questContent').doc(String(week)).get();
  if (!contentDoc.exists) {
    await sendWhatsAppMessage(phone, `Week ${week} content is not available yet.`);
    return;
  }

  const content = contentDoc.data() as QuestContent;
  const videoUrl = content.videoLinks?.[currentVideoIndex];
  
  const bookTitle = content.books || content.weekTitle;

  const msg = `📺 *Week ${week} — ${bookTitle}*\n\nHere is your video for the week.`;

  // Send message, appending media if valid URL exists
  await sendWhatsAppMessage(phone, msg, videoUrl ? [videoUrl] : undefined);

  // Increment video index
  await advanceQuestVideo(phone);

  logger.info({ phone, week, videoIndex: currentVideoIndex }, 'Early Quest video delivered');
};
