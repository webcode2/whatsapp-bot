/**
 * milestones/{milestoneId}
 *
 * Milestone progression messages shown to users as they hit streak or vine thresholds.
 * The system checks against User.streak and User.vineStage after each daily send.
 *
 * milestoneId convention: "streak-{n}" or "vine-{stage}" e.g. "streak-7", "vine-Rooted"
 */
export interface Milestone {
  streak: number;         // streak count that triggers this milestone (0 = vine-only)
  vineStage: string;      // vine stage name (e.g. "Rooted") — "" if streak-only milestone
  message: string;        // celebratory message sent to the user
}
