import { validateReminderTime, computeNextSendAt, computeNextReminderAt } from '../utils/timezone';
import { DateTime, Settings } from 'luxon';

describe('Timezone Utility', () => {
  // ─── validateReminderTime ────────────────────────────────────────────────────

  describe('validateReminderTime', () => {
    it('should accept valid hours (0–23) and minutes (0–59)', () => {
      expect(validateReminderTime(0, 0)).toBe(true);
      expect(validateReminderTime(8, 30)).toBe(true);
      expect(validateReminderTime(23, 59)).toBe(true);
    });

    it('should reject invalid hours', () => {
      expect(validateReminderTime(-1, 0)).toBe(false);
      expect(validateReminderTime(24, 0)).toBe(false);
      expect(validateReminderTime(100, 0)).toBe(false);
    });

    it('should reject invalid minutes', () => {
      expect(validateReminderTime(8, -1)).toBe(false);
      expect(validateReminderTime(8, 60)).toBe(false);
    });

    it('should reject non-number types', () => {
      expect(validateReminderTime('8' as unknown as number, 0)).toBe(false);
      expect(validateReminderTime(8, null as unknown as number)).toBe(false);
    });
  });

  // ─── computeNextSendAt ───────────────────────────────────────────────────────

  describe('computeNextSendAt', () => {
    it('should return a valid Date object', () => {
      const result = computeNextSendAt('Africa/Lagos', 8, 0);
      expect(result).toBeInstanceOf(Date);
    });

    it('should schedule in the future', () => {
      const result = computeNextSendAt('America/New_York', 8, 0);
      // The result should always be in the future or at least now
      // (within a reasonable tolerance since test execution takes time)
      const now = new Date();
      // Allow 1 second tolerance for slow test runners
      expect(result.getTime()).toBeGreaterThanOrEqual(now.getTime() - 1000);
    });

    it('should produce UTC output regardless of timezone input', () => {
      const lagosResult = computeNextSendAt('Africa/Lagos', 8, 0);
      const nyResult = computeNextSendAt('America/New_York', 8, 0);

      // Both should be valid UTC dates — they represent 8:00 AM in their
      // respective local timezones, so the UTC timestamps MUST differ
      expect(lagosResult.toISOString()).toMatch(/Z$/);
      expect(nyResult.toISOString()).toMatch(/Z$/);

      // Lagos (UTC+1) and NY (UTC-4/5) scheduling 8 AM local
      // should produce different UTC timestamps
      expect(lagosResult.getTime()).not.toBe(nyResult.getTime());
    });

    it('should handle DST-affected timezones without crashing', () => {
      // US Eastern can be UTC-4 (EDT) or UTC-5 (EST)
      expect(() => computeNextSendAt('America/New_York', 2, 30)).not.toThrow();
      expect(() => computeNextSendAt('Europe/London', 1, 0)).not.toThrow();
    });

    it('should handle edge-case timezones', () => {
      // UTC itself
      expect(() => computeNextSendAt('UTC', 12, 0)).not.toThrow();
      // India (UTC+5:30 — half-hour offset)
      expect(() => computeNextSendAt('Asia/Kolkata', 6, 0)).not.toThrow();
      // Nepal (UTC+5:45 — quarter-hour offset)
      expect(() => computeNextSendAt('Asia/Kathmandu', 6, 0)).not.toThrow();
    });
  });

  // ─── computeNextReminderAt ───────────────────────────────────────────────────

  describe('computeNextReminderAt', () => {
    it('should schedule reminders at 20:00 local time', () => {
      const result = computeNextReminderAt('Africa/Lagos');
      // Convert back to the target timezone and verify the hour is 20
      const localDt = DateTime.fromJSDate(result).setZone('Africa/Lagos');
      expect(localDt.hour).toBe(20);
      expect(localDt.minute).toBe(0);
    });

    it('should work for different timezones', () => {
      const ny = computeNextReminderAt('America/New_York');
      const lagos = computeNextReminderAt('Africa/Lagos');
      const kolkata = computeNextReminderAt('Asia/Kolkata');

      // All three should represent 8:00 PM in their local zones
      expect(DateTime.fromJSDate(ny).setZone('America/New_York').hour).toBe(20);
      expect(DateTime.fromJSDate(lagos).setZone('Africa/Lagos').hour).toBe(20);
      expect(DateTime.fromJSDate(kolkata).setZone('Asia/Kolkata').hour).toBe(20);
    });
  });
});
