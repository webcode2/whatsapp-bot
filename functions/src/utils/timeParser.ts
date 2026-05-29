/**
 * Parses a user-supplied time string into a structured time object.
 *
 * Handles formats:
 *   "6am", "6AM", "6 am"
 *   "6:00", "06:00", "6:00am", "6:00 AM"
 *   "6pm", "18:00", "18"
 *   "6", "06"
 *
 * Returns null if the input cannot be parsed (caller should re-prompt).
 */
export interface ParsedTime {
  hour: number;    // 0-23
  minute: number;  // 0-59
  display: string; // "HH:mm" e.g. "06:00"
}

export const parseTime = (input: string): ParsedTime | null => {
  const raw = input.trim().toLowerCase().replace(/\s+/g, '');

  // Match patterns: 6am, 6:30am, 06:30 am, 18:00, 18, 6
  const pattern = /^(\d{1,2})(?::(\d{2}))?(?:\s*)?(am|pm)?$/;
  const match = raw.match(pattern);

  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3];

  if (isNaN(hour) || isNaN(minute)) return null;
  if (minute < 0 || minute > 59) return null;

  if (meridiem === 'am') {
    if (hour === 12) hour = 0; // 12am = midnight
  } else if (meridiem === 'pm') {
    if (hour !== 12) hour += 12; // 6pm = 18, but 12pm stays 12
  }

  // Validate 24hr range
  if (hour < 0 || hour > 23) return null;

  const display = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  return { hour, minute, display };
};
