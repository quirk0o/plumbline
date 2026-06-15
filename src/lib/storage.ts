import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { env } from '../server/env'

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
})

const bucket = env.S3_BUCKET

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

export interface StoredObject {
  body: Buffer
  contentType: string
}

/**
 * Fetches an object's bytes and content type. Returns `null` if the object does
 * not exist; rethrows any other (transient/credential/network) error so callers
 * can distinguish "missing" from "storage failure".
 *
 * The bytes are returned (not a presigned URL) because the media route streams
 * them through a stable same-origin URL — `next/image`'s optimizer does not
 * follow 302 redirects to presigned URLs.
 */
export async function getObject(key: string): Promise<StoredObject | null> {
  try {
    const response = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    )
    const body = Buffer.from(await response.Body!.transformToByteArray())
    return {
      body,
      contentType: response.ContentType ?? 'application/octet-stream',
    }
  } catch (err) {
    const name = (err as { name?: string })?.name
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode
    if (name === 'NoSuchKey' || name === 'NotFound' || status === 404) {
      return null
    }
    throw err
  }
}
