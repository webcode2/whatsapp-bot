/**
 * prayerThemes/{themeId}/prayers/{prayerId}
 *
 * Individual prayer entries within a NEED theme.
 * Fetched sequentially by index — User.needPrayerIndex tracks the position.
 *
 * prayerId convention: "prayer-{index}" e.g. "prayer-0", "prayer-1"
 */
export interface ThemePrayer {
  index: number;                 // 0-based position within the theme
  prayerText: string;            // full prayer body
  declarationText: string;       // spoken declaration to follow the prayer
  declarationAudioUrl: string;   // audio URL for the declaration
  verse: string;                 // supporting scripture (text only)
}
