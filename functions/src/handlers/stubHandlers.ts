import { sendWhatsAppMessage } from '../services/twilioService';
import { handleOnboarding as _handleOnboarding } from './onboardingHandler';

const stubReply = async (phone: string, featureName: string) => {
  await sendWhatsAppMessage(phone, `[STUB] ${featureName} feature coming soon!`);
};

export const handleOnboarding = _handleOnboarding;

export const deliverDevotion = async (phone: string, _userData: any) => stubReply(phone, 'Seek Devotion');
export const deliverDeclaration = async (phone: string, _userData: any) => stubReply(phone, 'Knock Declaration');
export const sendVineStatus = async (phone: string, _userData: any) => stubReply(phone, 'Vine Status');
export const triggerNeedSelection = async (phone: string) => stubReply(phone, 'Need Selection');
export const updateReminderTime = async (phone: string) => stubReply(phone, 'Remind Settings');
export const handleQuestOnboarding = async (phone: string, _userData: any) => stubReply(phone, 'Quest Onboarding');
export const deliverNextVideoEarly = async (phone: string, _userData: any) => stubReply(phone, 'Watch Video');
export const triggerWeeklyQuiz = async (phone: string, _userData: any) => stubReply(phone, 'Weekly Quiz');
export const handleFallback = async (phone: string) => {
  // sent a  template
  await sendWhatsAppMessage(phone, "I didn't catch that... Try sending ASK, PAUSE, or HELP.");
};
