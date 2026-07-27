import { AwsClient } from 'aws4fetch';
import type { Env } from './env';

const PRESIGN_EXPIRY_SECONDS = 900;

/**
 * Signs a PUT URL so the browser can stream the file straight into R2 without
 * the bytes passing through the Worker. Nothing beyond the host is signed, so
 * the client must not add extra headers to the upload request.
 */
export async function presignUpload(
  env: Env & { R2_ACCOUNT_ID: string; R2_ACCESS_KEY_ID: string; R2_SECRET_ACCESS_KEY: string; R2_BUCKET_NAME: string },
  key: string,
): Promise<string> {
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });

  const url = new URL(
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${encodeKey(key)}`,
  );
  url.searchParams.set('X-Amz-Expires', String(PRESIGN_EXPIRY_SECONDS));

  const signed = await client.sign(url.toString(), {
    method: 'PUT',
    aws: { signQuery: true },
  });
  return signed.url;
}

/** Percent-encodes each path segment while leaving the separators intact. */
function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}
