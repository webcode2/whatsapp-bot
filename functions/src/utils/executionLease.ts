import { getFirestore } from 'firebase-admin/firestore';
import pino from 'pino';

const logger = pino();

/**
 * Claims an execution lease on a Firestore document using a transaction.
 * Returns true if the lease was successfully claimed, false if already locked.
 */
export const claimExecutionLease = async (
  collectionName: string,
  docId: string,
  leaseDurationMs = 5 * 60 * 1000
): Promise<boolean> => {
  const db = getFirestore();
  const docRef = db.collection(collectionName).doc(docId);

  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) return false;

      const data = doc.data()!;
      const now = Date.now();

      if (data.lockedUntil && data.lockedUntil.toMillis() > now) {
        return false;
      }

      transaction.update(docRef, {
        lockedUntil: new Date(now + leaseDurationMs),
        updatedAt: new Date(),
      });

      return true;
    });
  } catch (error) {
    logger.error({ error, docId }, `Failed to claim lease for ${collectionName}/${docId}`);
    return false;
  }
};

/**
 * Releases a previously claimed execution lease.
 */
export const releaseExecutionLease = async (collectionName: string, docId: string): Promise<void> => {
  const db = getFirestore();
  await db.collection(collectionName).doc(docId).update({
    lockedUntil: null,
    updatedAt: new Date(),
  });
};
