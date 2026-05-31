import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async () => 'https://signed.example/url'),
}))

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { putObject, objectExists, presignGetUrl } from './storage'

const s3Mock = mockClient(S3Client)

beforeEach(() => {
  s3Mock.reset()
  vi.clearAllMocks()
})

describe('putObject', () => {
  it('sends a PutObjectCommand with key, body, content type, and configured bucket', async () => {
    s3Mock.on(PutObjectCommand).resolves({})
    await putObject('uploads/user-1/file.png', Buffer.from('bytes'), 'image/png')
    const calls = s3Mock.commandCalls(PutObjectCommand)
    expect(calls).toHaveLength(1)
    expect(calls[0].args[0].input).toMatchObject({
      Bucket: 'simtrack-test',
      Key: 'uploads/user-1/file.png',
      Body: Buffer.from('bytes'),
      ContentType: 'image/png',
    })
  })
})

describe('objectExists', () => {
  it('returns true when HeadObject resolves', async () => {
    s3Mock.on(HeadObjectCommand).resolves({})
    expect(await objectExists('uploads/user-1/file.png')).toBe(true)
  })

  it('returns false when HeadObject rejects with NotFound', async () => {
    s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound' })
    expect(await objectExists('uploads/user-1/missing.png')).toBe(false)
  })

  it('rethrows non-404 errors instead of reporting the object missing', async () => {
    s3Mock
      .on(HeadObjectCommand)
      .rejects({ name: 'InternalError', $metadata: { httpStatusCode: 500 } })
    await expect(objectExists('uploads/user-1/boom.png')).rejects.toBeTruthy()
  })
})

describe('presignGetUrl', () => {
  it('returns a presigned URL for the key', async () => {
    const url = await presignGetUrl('uploads/user-1/file.png', 300)
    expect(url).toBe('https://signed.example/url')
    expect(getSignedUrl).toHaveBeenCalledTimes(1)
    expect(vi.mocked(getSignedUrl).mock.calls[0][2]).toMatchObject({
      expiresIn: 300,
    })
  })
})
