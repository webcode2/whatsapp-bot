import { getFirestore } from 'firebase-admin/firestore';
import { sendWhatsAppMessage } from '../services/twilioService';
import type { User, QuestLog } from '../types/schemas';

/**
 * Handles the PROGRESS keyword.
 * Fetches the user's current Quest stats and historical quiz scores.
 */
export const sendQuestProgress = async (phone: string, user: Partial<User> | null): Promise<void> => {
  if (!user || !user.name) {
    await sendWhatsAppMessage(phone, `Type *QUEST* to join the Bible-in-a-Year programme first. 📖`);
    return;
  }

  if (!user.questActive) {
    await sendWhatsAppMessage(phone, `You haven't started The Quest yet. Type *QUEST* to begin. 📖`);
    return;
  }

  const db = getFirestore();
  const week = user.questWeek || 1;
  const videosWatched = user.questVideoIndex || 0;
  const totalChapters = user.questChaptersLogged || 0;

  // 1. Fetch current week's Quest Content to get the book name
  let bookName = 'the Word';
  let weekIntro = 'God is walking with you today.';
  try {
    const contentDoc = await db.collection('questContent').doc(String(week)).get();
    if (contentDoc.exists) {
      const content = contentDoc.data() as any;
      if (content.books) bookName = content.books;
      if (content.weekIntro) weekIntro = content.weekIntro;
    }
  } catch (error) {
    // Ignore fetch errors, fallback to generic strings
  }

  // 2. Fetch quiz scores from questLog
  let quizScoresText = '';
  try {
    const logsSnap = await db.collection('users').doc(phone.replace('+', '')).collection('questLog').get();
    const scores: { week: number; score: number; total: number }[] = [];

    logsSnap.forEach(doc => {
      const data = doc.data() as QuestLog;
      if (data.quizWeek !== undefined && data.quizScore !== undefined && data.quizTotal !== undefined) {
        // Prevent duplicate weeks if they somehow took it twice (keep the highest or latest, for now just push all and filter)
        scores.push({
          week: data.quizWeek,
          score: data.quizScore,
          total: data.quizTotal
        });
      }
    });

    if (scores.length > 0) {
      // Sort by week ascending
      scores.sort((a, b) => a.week - b.week);
      
      // Format: "Week 1: 4/4, Week 2: 3/4"
      const formattedScores = scores.map(s => `Week ${s.week}: ${s.score}/${s.total}`).join(', ');
      quizScoresText = `\nQuiz scores: ${formattedScores}`;
    }
  } catch (error) {
    // Ignore log fetch errors
  }

  // 3. Construct and send the progress message
  const message = `Your Quest — ${user.name}\nWeek: ${week} of 52\nVideos watched this week: ${videosWatched} of 3\nTotal chapters logged: ${totalChapters}${quizScoresText}\nKeep going. You are in ${bookName} — ${weekIntro}`;

  await sendWhatsAppMessage(phone, message);
};
