/**
 * questContent/{weekNumber}
 *
 * Quest curriculum — one document per week (1-52).
 * The document ID is the week number as a string: "1", "2" … "52".
 */

export interface QuestQuestion {
  question: string;
  options: string[];        // always 3 options (A, B, C)
  answerIndex: number;      // 0-based correct answer index
  explanation?: string;     // brief explanation shown after answering (optional — can be added later)
}

export interface QuestContent {
  weekNumber: number;
  weekTitle: string;          // e.g. "In the Beginning"
  books: string;              // e.g. "Genesis 1-25"
  weekIntro?: string;         // intro paragraph sent on QUEST enrollment or WATCH (optional — fill in later)
  videoLinks: string[];       // 3 links: [Monday, Wednesday, Friday]
  videoPrompts?: string[];    // 3 brief captions/descriptions for each video (optional — fill in later)
  quizQuestions: QuestQuestion[];  // 4 questions per week
}
