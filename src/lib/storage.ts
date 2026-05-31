import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },
})

const bucket = process.env.S3_BUCKET ?? ''

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

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (err) {
    const name = (err as { name?: string })?.name
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode
    if (name === 'NotFound' || name === 'NoSuchKey' || status === 404) {
      return false
    }
    throw err
  }
}

export async function presignGetUrl(
  key: string,
  expiresInSeconds = 300,
): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  })
}
