/**
 * userNeedSessions/{userId}
 *
 * Active NEED prayer theme session for a user.
 * Separated from users/ (3NF): NEED state is functionally independent
 * of user identity — it can be reset, swapped, or queried independently.
 */
export interface UserNeedSession {
  userId: string;
  activeThemeId: string;   // references prayerThemes/{themeId}
  prayerIndex: number;     // which card in the theme (0-based)
  startedAt: Date;
  updatedAt: Date;
}
