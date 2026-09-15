import 'server-only';

import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const env = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) throw new Error('R2 environment is missing');
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl: publicBaseUrl.replace(/\/$/, '') };
};

const client = () => {
  const config = env();
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
};

export const hasR2Env = () => Boolean(
  process.env.R2_ACCOUNT_ID
  && process.env.R2_ACCESS_KEY_ID
  && process.env.R2_SECRET_ACCESS_KEY
  && process.env.R2_BUCKET_NAME
  && process.env.R2_PUBLIC_BASE_URL,
);

export async function presignUpload(key: string, bytes: number) {
  const config = env();
  const command = new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: 'image/webp', ContentLength: bytes });
  return getSignedUrl(client(), command, { expiresIn: 90 });
}

export async function verifyUpload(key: string) {
  const config = env();
  const result = await client().send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
  return {
    bytes: result.ContentLength || 0,
    contentType: result.ContentType || '',
    imageUrl: `${config.publicBaseUrl}/${key}`,
  };
}

export async function deleteR2Object(key: string) {
  if (!key.startsWith('guessr/images/')) throw new Error('Image object key is invalid');
  const config = env();
  await client().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}
