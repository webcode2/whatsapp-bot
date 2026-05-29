/**
 * prayerThemes/{themeId}
 *
 * NEED prayer categories. Users select a theme via the NEED keyword.
 * Prayers live in the sub-collection: prayerThemes/{themeId}/prayers/{prayerId}
 */
export interface PrayerTheme {
  themeId: string;        // matches document ID
  displayName: string;    // shown to user e.g. "Healing", "Financial Breakthrough"
  category: string;       // grouping e.g. "Health", "Finance", "Relationships"
  number: number;         // sort order in the selection menu
  available: boolean;     // false = hidden from menu (upcoming/maintenance)
}
