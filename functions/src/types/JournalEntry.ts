

/**
 * users/{phone}/journal/{YYYY-MM-DD}
 *
 * One document per day. The date key is the user's local calendar date.
 */
export interface JournalEntry {
  prompt: string;          // the journal prompt that was shown
  response: string;        // the user's typed reply
  verse: string;           // scripture associated with the day's card
  theme: string;           // theme name (e.g. "Trust", "Healing")
  timestamp: Date;    // when the entry was saved
}
