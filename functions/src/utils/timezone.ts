import { DateTime } from 'luxon';

/**
 * Validates if the given reminder hour and minute are within acceptable ranges.
 */
export const validateReminderTime = (hour: number, minute: number): boolean => {
  if (typeof hour !== 'number' || typeof minute !== 'number') return false;
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
};

/**
 * Computes the next send-at timestamp (UTC) for a given timezone, hour, and minute.
 * If the computed time today has already passed, it schedules for tomorrow.
 */
export const computeNextSendAt = (timezone: string, hour: number, minute: number): Date => {
  const now = DateTime.now().setZone(timezone);
  let next = now.set({ hour, minute, second: 0, millisecond: 0 });

  if (next <= now) {
    next = next.plus({ days: 1 });
  }

  return next.toUTC().toJSDate();
};

/**
 * Computes the next reminder timestamp (UTC) for a given timezone.
 * Reminders are strictly at 8:00 PM (20:00) local time.
 */
export const computeNextReminderAt = (timezone: string): Date => {
  return computeNextSendAt(timezone, 20, 0);
};
