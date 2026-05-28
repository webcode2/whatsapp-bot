import { sendWhatsAppMessage } from '../services/twilioService';

const stubReply = async (phone: string, featureName: string) => {
  await sendWhatsAppMessage(phone, `[STUB] ${featureName} feature coming soon!`);
};

export const handleOnboarding = async (phone: string, user: any) => {
  if (user) {
    await sendWhatsAppMessage(phone, "You're already part of ASK! Reply SEEK or KNOCK to continue.");
    return;
  }
  await sendWhatsAppMessage(phone, `[STUB] ASK Onboarding feature coming soon!`);
};
export const deliverDevotion = async (phone: string, _userData: any) => stubReply(phone, 'Seek Devotion');
export const deliverDeclaration = async (phone: string, _userData: any) => stubReply(phone, 'Knock Declaration');
export const sendVineStatus = async (phone: string, _userData: any) => stubReply(phone, 'Vine Status');
export const triggerNeedSelection = async (phone: string) => stubReply(phone, 'Need Selection');
export const updateReminderTime = async (phone: string) => stubReply(phone, 'Remind Settings');
export const handleQuestOnboarding = async (phone: string, _userData: any) => stubReply(phone, 'Quest Onboarding');
export const deliverNextVideoEarly = async (phone: string, _userData: any) => stubReply(phone, 'Watch Video');
export const logIndependentChapter = async (phone: string, _rawText: string) => stubReply(phone, 'Log Chapter');
export const triggerWeeklyQuiz = async (phone: string, _userData: any) => stubReply(phone, 'Weekly Quiz');
export const sendQuestProgress = async (phone: string, _userData: any) => stubReply(phone, 'Quest Progress');
export const handleFallback = async (phone: string) => {
  await sendWhatsAppMessage(phone, "I didn't catch that... Try sending ASK, PAUSE, or HELP.");
};
