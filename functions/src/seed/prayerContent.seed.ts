import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';
import type { PrayerCard } from '../types/PrayerCard';
import type { PrayerTheme } from '../types/PrayerTheme';
import type { ThemePrayer } from '../types/ThemePrayer';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'whatapp-497611';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}
const db = admin.firestore();

// ─── DATA: SEEK (PrayerCards / Devotions) ────────────────────────────────────

// For simplicity in the seed, we mock Stage 1 (Believe) Days 1-3.
const seekDevotions: PrayerCard[] = [
  {
    journeyStage: 1,
    dayIndex: 1,
    theme: 'Believe',
    verse: 'For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',
    reference: 'John 3:16',
    devotionText: 'Belief is the foundation of our journey. Today, we remember that love is the very reason we are invited into this family. God’s love is not distant; it is active and sacrificial.',
    devotionLink: 'https://youtube.com/shorts/sample1',
    reflectionQuestion: 'How does knowing you are deeply loved change the way you face today’s challenges?',
    declarationText: 'I am loved unconditionally, and my belief in Him brings me eternal life and daily peace.',
    declarationAudioUrl: 'https://audio.example.com/dec1.mp3',
    journalPrompt: 'Write down a moment today where you felt God’s love or peace.',
  },
  {
    journeyStage: 1,
    dayIndex: 2,
    theme: 'Trust',
    verse: 'Trust in the LORD with all your heart and lean not on your own understanding.',
    reference: 'Proverbs 3:5',
    devotionText: 'Trusting God means surrendering our need to know everything. When the path ahead seems unclear, we lean on His character, not our limited perspective.',
    devotionLink: 'https://youtube.com/shorts/sample2',
    reflectionQuestion: 'What situation in your life are you struggling to hand over to God?',
    declarationText: 'I choose to trust God completely today. His plans for me are good.',
    declarationAudioUrl: 'https://audio.example.com/dec2.mp3',
    journalPrompt: 'What does surrendering control look like for you today?',
  },
  {
    journeyStage: 1,
    dayIndex: 3,
    theme: 'Faith',
    verse: 'Now faith is confidence in what we hope for and assurance about what we do not see.',
    reference: 'Hebrews 11:1',
    devotionText: 'Faith operates in the realm of the unseen. It is the steady assurance that God is working behind the scenes, even when our current circumstances haven’t changed.',
    devotionLink: '',
    reflectionQuestion: 'Where do you need the assurance of faith the most right now?',
    declarationText: 'My faith is anchored in God’s promises, not in my current circumstances.',
    declarationAudioUrl: 'https://audio.example.com/dec3.mp3',
    journalPrompt: 'Write a prayer asking God to strengthen your faith.',
  },
];

// ─── DATA: NEED (PrayerThemes & ThemePrayers) ────────────────────────────────

const needThemes: { theme: PrayerTheme; prayers: ThemePrayer[] }[] = [
  {
    theme: {
      themeId: 'healing',
      displayName: 'Physical & Emotional Healing',
      category: 'Health',
      number: 1,
      available: true,
    },
    prayers: [
      {
        index: 0,
        verse: 'Heal me, LORD, and I will be healed; save me and I will be saved, for you are the one I praise. (Jeremiah 17:14)',
        prayerText: 'Lord, I come to you seeking Your healing touch. Wash over my body and mind with Your restoring power. Comfort me in my pain and renew my strength day by day.',
        declarationText: 'I receive God’s healing power. Every cell in my body aligns with His perfect will.',
        declarationAudioUrl: 'https://audio.example.com/heal1.mp3',
      },
      {
        index: 1,
        verse: 'He gives strength to the weary and increases the power of the weak. (Isaiah 40:29)',
        prayerText: 'Father, I feel weak and drained. Please pour Your divine strength into me. Carry me when I cannot walk and sustain me through this trial.',
        declarationText: 'The joy of the Lord is my strength. I am being renewed day by day.',
        declarationAudioUrl: 'https://audio.example.com/heal2.mp3',
      }
    ],
  },
  {
    theme: {
      themeId: 'finance',
      displayName: 'Financial Breakthrough',
      category: 'Finance',
      number: 2,
      available: true,
    },
    prayers: [
      {
        index: 0,
        verse: 'And my God will meet all your needs according to the riches of his glory in Christ Jesus. (Philippians 4:19)',
        prayerText: 'Lord, I place my financial burdens at Your feet. Give me wisdom to steward what I have and open doors for provision that only You can provide.',
        declarationText: 'God is my provider. All my needs are met abundantly in Christ Jesus.',
        declarationAudioUrl: 'https://audio.example.com/fin1.mp3',
      }
    ],
  },
  {
    theme: {
      themeId: 'peace',
      displayName: 'Anxiety & Peace',
      category: 'Mental Health',
      number: 3,
      available: true,
    },
    prayers: [
      {
        index: 0,
        verse: 'Peace I leave with you; my peace I give you. I do not give to you as the world gives. Do not let your hearts be troubled and do not be afraid. (John 14:27)',
        prayerText: 'Lord, calm the storm in my mind. Silence the anxious thoughts and replace them with Your perfect peace that transcends understanding.',
        declarationText: 'I reject fear. The peace of God guards my heart and mind today.',
        declarationAudioUrl: 'https://audio.example.com/peace1.mp3',
      }
    ],
  }
];


async function clearCollection(path: string) {
  const snap = await db.collection(path).get();
  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`🗑️ Cleared ${snap.size} documents from ${path}`);
}

async function seed() {
  console.log(`\n🌱 Seeding Devotions & Prayers into ${PROJECT_ID}...`);

  // 1. Seed prayerCards
  await clearCollection('prayerCards');
  let cardCount = 0;
  for (const card of seekDevotions) {
    const cardId = `stage${card.journeyStage}-day${card.dayIndex}`;
    await db.collection('prayerCards').doc(cardId).set(card);
    cardCount++;
  }
  console.log(`✅ Seeded ${cardCount} PrayerCards (SEEK devotions)`);

  // 2. Seed prayerThemes & their sub-collections
  await clearCollection('prayerThemes');
  let themeCount = 0;
  let prayerCount = 0;

  for (const item of needThemes) {
    const themeRef = db.collection('prayerThemes').doc(item.theme.themeId);
    await themeRef.set(item.theme);
    themeCount++;

    // Sub-collection
    for (const prayer of item.prayers) {
      const prayerId = `prayer-${prayer.index}`;
      await themeRef.collection('prayers').doc(prayerId).set(prayer);
      prayerCount++;
    }
  }
  console.log(`✅ Seeded ${themeCount} PrayerThemes with ${prayerCount} ThemePrayers (NEED prayers)`);

  console.log('🎉 Seeding Complete!\n');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
