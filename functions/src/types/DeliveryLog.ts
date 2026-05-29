

/**
 * deliveryLogs/{logId}
 *
 * Operational log of every outbound message attempt.
 * Derived from scheduler runs, Twilio retries, and worker outcomes.
 * Used for debugging, retry analysis, and Twilio delivery tracking.
 *
 * logId convention: auto-generated Firestore ID (addDoc)
 */
export interface DeliveryLog {
  userId: string;      // phone number — matches users/{phone} document ID

  type:
    | 'ASK'            // onboarding message
    | 'SEEK'           // morning devotion (SEEK keyword)
    | 'KNOCK'          // declaration send
    | 'JOURNAL'        // journal prompt
    | 'NEED'           // NEED theme prayer
    | 'QUEST'          // quest enrollment / video
    | 'WATCH'          // Quest video delivery
    | 'QUIZ'           // quiz question / result
    | 'PROGRESS'       // PROGRESS summary
    | 'MORNING_CARD'   // scheduled morning card (worker)
    | 'REMINDER'       // evening reminder nudge (worker)
    | 'CHECKIN';       // inactivity check-in

  status: 'sent' | 'failed' | 'skipped';

  error?: string;      // Twilio error message or internal error description

  sentAt: Date;
}
