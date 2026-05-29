

/**
 * users/{phone}/declarations/{YYYY-MM-DD}
 *
 * One document per day — tracks how many times the user declared
 * and the full text of the declaration for that day.
 */
export interface DeclarationLog {
  count: number;                    // how many times they tapped/sent KNOCK today
  timestamps: Date[];          // each individual declaration moment
  declarationText: string;          // the full declaration text shown
}
