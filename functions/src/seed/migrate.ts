#!/usr/bin/env npx ts-node
/**
 * Firestore Schema Migration
 * ────────────────────────────────────────────────────────────────────────────
 * Migrates the live Firestore from the OLD schema to the NEW schema.
 *
 * WHAT IT DOES:
 *   1. For every user in users/{phone}:
 *      - Adds missing fields required by the new User schema
 *      - Derives reminderTimeUTC from existing reminderHour/reminderMinute (if present)
 *      - Merges state from userNeedSessions/{phone} → user.activeNeedTheme / needPrayerIndex
 *      - Merges state from questProgress/{phone}   → user.questActive / questWeek / etc.
 *      - Removes deprecated fields: userId, reminderHour, reminderMinute, lastSentAt, reminderSentToday
 *   2. Deletes all documents in deprecated collections:
 *      - userNeedSessions
 *      - questProgress
 *      - quizSessions
 *
 * SAFE TO RE-RUN — idempotent. Skips fields that are already set correctly.
 *
 * RUN:
 *   npx ts-node functions/src/seed/migrate.ts
 *
 * REQUIRES: Application Default Credentials
 *   gcloud auth application-default login
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'whatapp-497611';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toUTCBucket = (hour: number, minute: number): string => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
};

const deleteCollection = async (colId: string): Promise<number> => {
  const snap = await db.collection(colId).get();
  if (snap.empty) return 0;

  const batches: admin.firestore.WriteBatch[] = [];
  let batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % 499 === 0) {
      batches.push(batch);
      batch = db.batch();
    }
  }
  batches.push(batch);

  for (const b of batches) await b.commit();
  return count;
};

// ─── Main migration ───────────────────────────────────────────────────────────

async function migrate() {
  console.log(`\n🚀  Firestore Schema Migration — Project: ${PROJECT_ID}`);
  console.log('────────────────────────────────────────────────────────────\n');

  // ── Step 1: Audit existing collections ──────────────────────────────────────
  const topCollections = await db.listCollections();
  console.log('📋  Current top-level collections:');
  for (const col of topCollections) {
    const count = (await col.count().get()).data().count;
    console.log(`     ${col.id}: ${count} docs`);
  }
  console.log('');

  // ── Step 2: Migrate user documents ──────────────────────────────────────────
  console.log('👤  Migrating users collection…');
  const usersSnap = await db.collection('users').get();
  console.log(`     Found ${usersSnap.size} users\n`);

  let migratedCount = 0;
  let skippedCount  = 0;
  let errorCount    = 0;

  for (const userDoc of usersSnap.docs) {
    const phone = userDoc.id;
    const data  = userDoc.data() as Record<string, any>;

    try {
      const updates: Record<string, any> = {};
      const deletes: Record<string, admin.firestore.FieldValue> = {};

      // ── Ensure phone field mirrors doc ID ─────────────────────────────────
      if (!data.phone) updates.phone = phone;

      // ── Derive reminderTimeUTC from old hour/minute fields ─────────────────
      if (!data.reminderTimeUTC && (data.reminderHour !== undefined || data.reminderTime)) {
        const [hStr, mStr] = (data.reminderTime ?? '06:00').split(':');
        const h = data.reminderHour ?? parseInt(hStr, 10);
        const m = data.reminderMinute ?? parseInt(mStr, 10);
        updates.reminderTimeUTC = toUTCBucket(h, m);
      }

      // ── Add missing reminder alias ─────────────────────────────────────────
      if (!data.reminderTimeLocal && data.reminderTime) {
        updates.reminderTimeLocal = data.reminderTime;
      }

      // ── NEED state (merge from userNeedSessions or default) ────────────────
      if (data.activeNeedTheme === undefined) {
        const needDoc = await db.collection('userNeedSessions').doc(phone).get();
        if (needDoc.exists) {
          const ns = needDoc.data()!;
          updates.activeNeedTheme  = ns.activeThemeId ?? ns.activeNeedTheme ?? '';
          updates.needPrayerIndex  = ns.prayerIndex   ?? ns.needPrayerIndex ?? 0;
          console.log(`     ↳ [${phone}] NEED session merged (theme: ${updates.activeNeedTheme})`);
        } else {
          updates.activeNeedTheme = '';
          updates.needPrayerIndex = 0;
        }
      }

      // ── Quest state (merge from questProgress or default) ──────────────────
      if (data.questActive === undefined) {
        const qpDoc = await db.collection('questProgress').doc(phone).get();
        if (qpDoc.exists) {
          const qp = qpDoc.data()!;
          updates.questActive        = qp.active        ?? false;
          updates.questWeek          = qp.week          ?? qp.currentWeek ?? 1;
          updates.questVideoIndex    = qp.videoIndex    ?? 0;
          updates.questChaptersLogged = qp.chaptersLogged ?? qp.totalChaptersLogged ?? 0;
          console.log(`     ↳ [${phone}] Quest progress merged (week: ${updates.questWeek}, active: ${updates.questActive})`);
        } else {
          updates.questActive         = false;
          updates.questWeek           = 1;
          updates.questVideoIndex     = 0;
          updates.questChaptersLogged = 0;
        }
      }

      // ── Quiz ephemeral state (always reset cleanly) ───────────────────────
      if (data.currentQuizQuestionIndex === undefined) updates.currentQuizQuestionIndex = 0;
      if (data.currentQuizScore === undefined)         updates.currentQuizScore         = 0;
      if (data.awaitingQuizAnswer === undefined)       updates.awaitingQuizAnswer       = false;

      // ── Missing boolean flags ─────────────────────────────────────────────
      if (data.awaitingNeedSelection === undefined)    updates.awaitingNeedSelection    = false;
      if (data.awaitingQuestConfirm === undefined)     updates.awaitingQuestConfirm     = false;
      if (data.eveningReminderSentToday === undefined) updates.eveningReminderSentToday = false;

      // ── Missing vine stage ─────────────────────────────────────────────────
      if (!data.vineStage) updates.vineStage = 'Grafted';

      // ── Deprecated fields to delete ───────────────────────────────────────
      if (data.userId !== undefined)          deletes.userId          = admin.firestore.FieldValue.delete();
      if (data.reminderHour !== undefined)    deletes.reminderHour    = admin.firestore.FieldValue.delete();
      if (data.reminderMinute !== undefined)  deletes.reminderMinute  = admin.firestore.FieldValue.delete();
      if (data.lastSentAt !== undefined)      deletes.lastSentAt      = admin.firestore.FieldValue.delete();
      if (data.reminderSentToday !== undefined) deletes.reminderSentToday = admin.firestore.FieldValue.delete();

      const hasChanges = Object.keys(updates).length > 0 || Object.keys(deletes).length > 0;

      if (hasChanges) {
        await userDoc.ref.update({
          ...updates,
          ...deletes,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        migratedCount++;
        const addedKeys   = Object.keys(updates).join(', ');
        const deletedKeys = Object.keys(deletes).join(', ');
        console.log(`  ✅ [${phone}]`);
        if (addedKeys)   console.log(`       + added:   ${addedKeys}`);
        if (deletedKeys) console.log(`       - removed: ${deletedKeys}`);
      } else {
        skippedCount++;
        console.log(`  ⏭  [${phone}] already up to date — skipped`);
      }

    } catch (err: any) {
      errorCount++;
      console.error(`  ❌ [${phone}] FAILED: ${err.message}`);
    }
  }

  console.log(`\n     Users migrated: ${migratedCount}`);
  console.log(`     Users skipped:  ${skippedCount}`);
  console.log(`     Errors:         ${errorCount}\n`);

  // ── Step 3: Delete deprecated top-level collections ──────────────────────────
  const toDelete = ['userNeedSessions', 'questProgress', 'quizSessions'];

  for (const colId of toDelete) {
    process.stdout.write(`🗑   Deleting ${colId}… `);
    const deleted = await deleteCollection(colId);
    console.log(deleted > 0 ? `${deleted} docs deleted` : 'already empty');
  }

  // ── Step 4: Deploy updated Firestore indexes ──────────────────────────────────
  console.log('\n📦  Firestore indexes are defined in firestore.indexes.json');
  console.log('     To deploy them, run:');
  console.log('       firebase deploy --only firestore --project whatapp-497611\n');

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅  Migration complete!');
  console.log(`      Project : ${PROJECT_ID}`);
  console.log(`      Users   : ${migratedCount} migrated, ${skippedCount} skipped, ${errorCount} errors`);
  if (errorCount > 0) {
    console.log('      ⚠️   Some users failed — check the output above and re-run.');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(errorCount > 0 ? 1 : 0);
}

migrate().catch((err) => {
  console.error('\n❌  Fatal migration error:', err.message);
  process.exit(1);
});
