import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = process.env.S3_BUCKET as string;
const REGION = process.env.S3_REGION as string;

function s3(): S3Client {
  return new S3Client({ region: REGION, credentials: undefined });
}

export async function createPresignedPut(key: string, contentType: string, expiresSeconds = 900): Promise<{ url: string; key: string }> {
  if (!BUCKET || !REGION) throw new Error('missing_s3_env');
  const client = s3();
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType, ACL: 'private' as any });
  const url = await getSignedUrl(client, cmd, { expiresIn: expiresSeconds });
  return { url, key };
}

export async function getObjectBody(key: string): Promise<Uint8Array> {
  if (!BUCKET || !REGION) throw new Error('missing_s3_env');
  const client = s3();
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const res = await client.send(cmd);
  const stream = res.Body as any as ReadableStream<Uint8Array> | NodeJS.ReadableStream;
  if (!stream) return new Uint8Array();
  // Convert to Buffer/Uint8Array
  if (typeof (stream as any).getReader === 'function') {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
    return out;
  } else {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      (stream as NodeJS.ReadableStream)
        .on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        .once('end', () => resolve())
        .once('error', reject);
    });
    const buf = Buffer.concat(chunks);
    return new Uint8Array(buf);
  }
}


