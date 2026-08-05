import type { Env } from './env';
import type { StoredItem, StoredSession } from './session';

/**
 * Aborting incomplete multipart uploads.
 *
 * This exists because of a gap that is easy to miss: the parts of an
 * incomplete multipart upload are not objects. They never appear in
 * `FILES.list()`, so the cron sweep in worker/index.ts cannot see them, and
 * deleting the key they are destined for does not remove them either — so
 * purgeObjects cannot either. Nothing reclaims them except an explicit abort.
 *
 * The binding also offers no way to enumerate uploads, so the uploadId stored
 * on the item is the only handle we will ever have. Once the session document
 * expires out of KV it is gone for good, and only the bucket's
 * "abort incomplete multipart uploads" lifecycle rule can clean up after us.
 * That rule is not optional; see the README.
 */

/** Items whose upload is still in flight and therefore still holding parts. */
function pendingUploads(session: StoredSession): StoredItem[] {
  return session.items.filter((item) => item.state === 'pending' && item.uploadId && item.key);
}

/**
 * Aborts one item's upload. Never throws: this runs on cleanup paths where the
 * caller's own work matters more, and an abort that fails because the upload
 * was already completed or already aborted has nothing to report.
 */
export async function abortUpload(env: Env, item: StoredItem): Promise<void> {
  if (!item.uploadId || !item.key) return;
  try {
    await env.FILES.resumeMultipartUpload(item.key, item.uploadId).abort();
  } catch (err) {
    console.error('multipart abort failed', item.key, err);
  } finally {
    item.uploadId = undefined;
  }
}

/**
 * Aborts every in-flight upload in a session. Called before the session and
 * its objects are torn down, which is the last moment the uploadIds exist.
 */
export async function abortSessionUploads(env: Env, session: StoredSession): Promise<void> {
  const pending = pendingUploads(session);
  if (pending.length === 0) return;
  await Promise.all(pending.map((item) => abortUpload(env, item)));
}
